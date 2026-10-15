import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetCatalogPiecesQueryKey, registerCatalogPiece } from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { buildPiece, type PieceProgress } from "../lib/buildPiece";
import type { CatalogFormatOption } from "../lib/formats";
import { newPieceKey, toPieceRecord } from "../lib/pieceRecord";
import { canShareFile, downloadFile, pieceFileName, shareFile } from "../lib/share";
import type { CatalogThemeOption } from "../lib/themes";
import { normalizeTitle } from "../template/text";
import type { CatalogProduct } from "../types";

export type GeneratorStatus = "idle" | "generating" | "ready" | "error";

/** A peça pronta: o arquivo, as URLs da prévia, quem saiu nela, com que título e em que formato. */
export interface GeneratedPiece {
  /**
   * A identidade DESTE arquivo no histórico. Trocar um produto ou o título gera
   * outro arquivo, e portanto outra chave.
   */
  key: string;
  file: File;
  /** Uma URL por página. No banner, uma só. */
  previewUrls: string[];
  products: CatalogProduct[];
  /** O título impresso — pode já não ser o do campo, se a pessoa mexeu nele. */
  title: string;
  /** O tema do sorteio (ou o Personalizado): é dele que sai a troca de produtos. */
  theme: CatalogThemeOption;
  /** O formato em que a peça foi desenhada: troca e título redesenham NELE. */
  format: CatalogFormatOption;
}

/** O que cada ação devolve ao caminho comum: a peça sem as URLs, mais as páginas da prévia. */
export type DrawnPiece = Omit<GeneratedPiece, "previewUrls"> & { pages: Blob[] };

/** Em que tema e formato a peça é desenhada. */
export interface PieceTarget {
  theme: CatalogThemeOption;
  format: CatalogFormatOption;
}

/**
 * O ciclo de vida de UMA peça na tela, igual para o sorteio e para a escolha à
 * mão (15/10/2026): gerar sem deixar a resposta atrasada cobrir a nova, mostrar
 * a prévia, compartilhar, baixar e registrar no histórico só o que saiu.
 *
 * Cada aba tem a sua: alternar entre o Automático e o Personalizado não apaga a
 * peça da outra.
 */
export function usePieceSession() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<GeneratorStatus>("idle");
  const [piece, setPiece] = useState<GeneratedPiece | null>(null);
  const [progress, setProgress] = useState<PieceProgress | null>(null);
  // O que está sendo desenhado AGORA ("banner" ou "catálogo"): pode não ser o
  // formato da peça que ainda está na moldura.
  const [busyNoun, setBusyNoun] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cada geração tem um número. Quem toca duas vezes só quer a última: a
  // resposta atrasada da primeira não pode cobrir a segunda.
  const runRef = useRef(0);
  // As peças que já foram para o histórico: compartilhar e depois baixar o
  // mesmo arquivo é uma divulgação só.
  const recordedRef = useRef(new Set<string>());

  // As URLs da prévia seguram os arquivos na memória; soltam ao trocar e ao sair.
  useEffect(() => {
    if (!piece) return;
    return () => piece.previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [piece]);

  useEffect(() => {
    // Sair no meio de uma geração a invalida: sem isto ela terminaria depois,
    // criaria a URL da prévia para uma tela que não existe mais, e ninguém
    // soltaria esse arquivo da memória.
    const runs = runRef;
    return () => {
      runs.current += 1;
    };
  }, []);

  /**
   * O caminho comum de toda ação: roda `work`, e só aplica o resultado se
   * nenhuma outra geração começou depois. O erro vira estado e aviso.
   *
   * Devolve `true` quando esta geração terminou sem erro e ainda é a última.
   */
  const run = useCallback(
    async (
      noun: string,
      work: (report: (progress: PieceProgress) => void) => Promise<DrawnPiece | null>,
    ): Promise<boolean> => {
      const current = ++runRef.current;
      setStatus("generating");
      setBusyNoun(noun);
      setErrorMessage(null);
      setProgress(null);

      try {
        const result = await work((value) => {
          if (current === runRef.current) setProgress(value);
        });
        if (current !== runRef.current) return false;

        if (result) {
          const { pages, ...drawn } = result;
          setPiece({ ...drawn, previewUrls: pages.map((page) => URL.createObjectURL(page)) });
        }
        setStatus("ready");
        return true;
      } catch (error) {
        if (current !== runRef.current) return false;

        const message = error instanceof Error ? error.message : `Erro desconhecido ao gerar o ${noun}.`;
        setErrorMessage(message);
        setStatus("error");
        toast({ variant: "destructive", title: `Não foi possível gerar o ${noun}`, description: message });
        return false;
      } finally {
        if (current === runRef.current) setProgress(null);
      }
    },
    [toast],
  );

  /** Desenha a peça com exatamente estes produtos (mais as reservas, se houver). */
  const draw = useCallback(
    async (
      target: PieceTarget,
      heading: string,
      products: CatalogProduct[],
      reserves: CatalogProduct[],
      report: (progress: PieceProgress) => void,
    ): Promise<DrawnPiece> => {
      const date = new Date();
      const printed = normalizeTitle(heading) || target.theme.title;
      const result = await buildPiece({
        format: target.format,
        title: printed,
        candidates: [...products, ...reserves],
        count: products.length,
        date,
        onProgress: report,
      });

      return {
        key: newPieceKey(),
        file: new File([result.blob], pieceFileName(printed, date, target.format.extension), {
          type: target.format.mimeType,
        }),
        pages: result.pages,
        products: result.products,
        title: printed,
        theme: target.theme,
        format: target.format,
      };
    },
    [],
  );

  /**
   * Avisa o servidor de que a peça SAIU do admin. É o que alimenta o histórico
   * (e, no sorteio, o descanso de quem saiu).
   *
   * Só a peça que saiu: a que ficou na tela não foi vista por cliente nenhum, e
   * "sortear de novo" dez vezes não pode contar como dez divulgações. A falha é
   * calada de propósito — a pessoa já tem o arquivo, e o registro não é tarefa
   * dela —, mas a chave volta a ficar livre para a próxima tentativa.
   */
  const record = useCallback(
    (target: GeneratedPiece) => {
      if (recordedRef.current.has(target.key)) return;
      recordedRef.current.add(target.key);

      registerCatalogPiece(toPieceRecord(target))
        .then(() => queryClient.invalidateQueries({ queryKey: [...getGetCatalogPiecesQueryKey()] }))
        .catch((error: unknown) => {
          recordedRef.current.delete(target.key);
          console.warn("Catálogo: não foi possível registrar a peça no histórico.", error);
        });
    },
    [queryClient],
  );

  const share = useCallback(async () => {
    if (!piece) return;

    const outcome = await shareFile(piece.file);
    // Fechar a folha sem escolher nada é desistência: a peça não saiu.
    if (outcome !== "cancelled") record(piece);

    if (outcome === "downloaded") {
      toast({
        title: piece.format.noun === "banner" ? "Banner salvo" : "Catálogo salvo",
        description: "O arquivo foi para a pasta de downloads deste aparelho.",
      });
    }
  }, [piece, record, toast]);

  const download = useCallback(() => {
    if (!piece) return;

    downloadFile(piece.file);
    record(piece);
  }, [piece, record]);

  return {
    status,
    piece,
    /** Em que página o desenho está. Só o catálogo em PDF tem mais de uma. */
    progress,
    /** O nome do que está sendo desenhado, para o aviso da moldura. */
    busyNoun,
    errorMessage,
    isGenerating: status === "generating",
    /** O aparelho abre a folha de compartilhamento com arquivo (celular)? */
    canShare: piece ? canShareFile(piece.file) : false,
    run,
    draw,
    share,
    download,
  };
}

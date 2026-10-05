import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  drawCatalog,
  getGetCatalogPiecesQueryKey,
  registerCatalogPiece,
  useGetCatalogThemes,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { buildPiece, preloadPiece, type PieceProgress } from "../lib/buildPiece";
import { ROLE_CODE, toCatalogProducts } from "../lib/catalogProducts";
import { CATALOG_FORMATS, DEFAULT_FORMAT, FORMAT_ORDER, type CatalogFormatOption } from "../lib/formats";
import { newPieceKey, toPieceRecord } from "../lib/pieceRecord";
import { canShareFile, downloadFile, pieceFileName, shareFile } from "../lib/share";
import { groupSwapsByRole, matchReplacements } from "../lib/swapPlan";
import { buildThemeOptions, DEFAULT_THEME_KEY, type CatalogThemeOption } from "../lib/themes";
import { normalizeTitle } from "../template/text";
import type { CatalogFormat, CatalogProduct } from "../types";

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
  /** O tema do sorteio: é dele que sai a troca de produtos. */
  theme: CatalogThemeOption;
  /** O formato em que a peça foi desenhada: troca e título redesenham NELE. */
  format: CatalogFormatOption;
}

/** O que cada ação devolve ao caminho comum: a peça sem as URLs, mais as páginas da prévia. */
type DrawnPiece = Omit<GeneratedPiece, "previewUrls"> & { pages: Blob[] };

const FORMATS = FORMAT_ORDER.map((key) => CATALOG_FORMATS[key]);

/**
 * Estado e ações da tela do catálogo de divulgação.
 *
 * A pessoa escolhe o formato e o tema, ajusta o título e gera; o servidor
 * sorteia e o navegador desenha. Depois dá para sortear tudo de novo, trocar os
 * produtos marcados ou reescrever o título — os dois últimos redesenham a MESMA
 * peça, no formato em que ela foi gerada.
 */
export function useCatalogGenerator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const themesQuery = useGetCatalogThemes();

  const themes = useMemo(() => buildThemeOptions(themesQuery.data ?? []), [themesQuery.data]);

  const [formatKey, setFormatKey] = useState<CatalogFormat>(DEFAULT_FORMAT);
  const [themeKey, setThemeKey] = useState(DEFAULT_THEME_KEY);
  // `null` = a pessoa não mexeu: vale o título sugerido pelo tema.
  const [typedTitle, setTypedTitle] = useState<string | null>(null);
  const [status, setStatus] = useState<GeneratorStatus>("idle");
  const [piece, setPiece] = useState<GeneratedPiece | null>(null);
  const [progress, setProgress] = useState<PieceProgress | null>(null);
  // O que está sendo desenhado AGORA ("banner" ou "catálogo"): pode não ser o
  // formato da peça que ainda está na moldura.
  const [busyNoun, setBusyNoun] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Quem a pessoa marcou na lista para trocar, na ordem dos toques.
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const format = CATALOG_FORMATS[formatKey];
  const theme = themes.find((option) => option.key === themeKey) ?? themes[0];
  const title = typedTitle ?? theme?.title ?? "";

  // Cada geração tem um número. Quem toca duas vezes só quer a última: a
  // resposta atrasada da primeira não pode cobrir a segunda.
  const runRef = useRef(0);
  // Quem já foi trocado nesta peça não volta na troca seguinte.
  const swappedOutRef = useRef<number[]>([]);
  // As peças que já foram para o histórico: compartilhar e depois baixar o
  // mesmo arquivo é uma divulgação só.
  const recordedRef = useRef(new Set<string>());

  // As URLs da prévia seguram os arquivos na memória; soltam ao trocar e ao sair.
  useEffect(() => {
    if (!piece) return;
    return () => piece.previewUrls.forEach((url) => URL.revokeObjectURL(url));
  }, [piece]);

  useEffect(() => {
    // Renderizador, fontes e artes começam a baixar enquanto a pessoa lê a tela.
    preloadPiece();

    // Sair no meio de uma geração a invalida: sem isto ela terminaria depois,
    // criaria a URL da prévia para uma tela que não existe mais, e ninguém
    // soltaria esse arquivo da memória.
    const runs = runRef;
    return () => {
      runs.current += 1;
    };
  }, []);

  /**
   * O caminho comum das três ações: roda `work`, e só aplica o resultado se
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
      target: { theme: CatalogThemeOption; format: CatalogFormatOption },
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

  const selectTheme = useCallback((key: string) => {
    setThemeKey(key);
    // Tema novo, título sugerido novo: o que a pessoa digitou era do outro tema.
    setTypedTitle(null);
  }, []);

  /** Sorteia uma peça nova no tema e no formato escolhidos. */
  const generate = useCallback(async () => {
    if (!theme) return;

    const done = await run(format.noun, async (report) => {
      // Sem cache de propósito: o preço vai IMPRESSO na peça e tem de ser o de agora.
      const drawn = await drawCatalog({
        theme: theme.theme,
        departmentId: theme.departmentId,
        count: format.count,
        spare: format.spare,
        largePhotosOnly: format.minPhotoSide > 0 || undefined,
      });

      const products = toCatalogProducts(drawn.items);
      if (products.length === 0) {
        throw new Error(`Este tema não tem produto com foto e saldo para montar o ${format.noun}.`);
      }

      swappedOutRef.current = [];
      return draw({ theme, format }, title, products, toCatalogProducts(drawn.reserves), report);
    });
    // Peça nova, produtos novos: a marcação era da outra.
    if (done) setSelectedIds([]);
  }, [draw, format, run, theme, title]);

  /** Marca ou desmarca um produto da peça para a próxima troca. */
  const toggleSelected = useCallback((productGroupId: number) => {
    setSelectedIds((current) =>
      current.includes(productGroupId)
        ? current.filter((id) => id !== productGroupId)
        : [...current, productGroupId],
    );
  }, []);

  const clearSelection = useCallback(() => setSelectedIds([]), []);

  /**
   * Troca de uma vez os produtos marcados, cada um por outro do MESMO papel, e
   * redesenha a peça UMA vez só; os demais não se mexem. Um sorteio por papel,
   * um depois do outro: cada um já evita quem o anterior trouxe.
   */
  const swap = useCallback(
    async (productGroupIds: readonly number[]) => {
      if (!piece) return;

      const swaps = groupSwapsByRole(piece.products, productGroupIds);
      if (swaps.length === 0) return;

      const done = await run(piece.format.noun, async (report) => {
        const inPiece = piece.products.map((product) => product.productGroupId);
        const drawn: CatalogProduct[][] = [];
        for (const { role, leaving } of swaps) {
          const response = await drawCatalog({
            theme: piece.theme.theme,
            departmentId: piece.theme.departmentId,
            count: leaving.length,
            role: ROLE_CODE[role],
            excludeGroupIds: [
              ...inPiece,
              ...swappedOutRef.current,
              ...drawn.flat().map((p) => p.productGroupId),
            ],
            largePhotosOnly: piece.format.minPhotoSide > 0 || undefined,
          });
          drawn.push(toCatalogProducts(response.items));
        }

        const replacements = matchReplacements(swaps, drawn, inPiece);
        if (replacements.size === 0) {
          toast({
            title: "Sem outro produto",
            description: "Não há outro produto neste tema para pôr no lugar.",
          });
          return null;
        }

        const products = piece.products.map((product) => replacements.get(product.productGroupId) ?? product);
        const result = await draw(piece, piece.title, products, [], report);

        // Aqui não há reserva para ceder a vaga: se a foto de um substituto não
        // carregou (ou é pequena demais para o catálogo), o montador o descartou
        // e a peça voltaria com um produto a menos, em silêncio. A troca não é
        // aplicada — a marcação fica, para tocar de novo —, e os substitutos de
        // foto quebrada entram na lista para não serem sorteados outra vez.
        if (result.products.length < products.length) {
          const loaded = new Set(result.products.map((product) => product.productGroupId));
          const broken = [...replacements.values()]
            .map((product) => product.productGroupId)
            .filter((id) => !loaded.has(id));
          swappedOutRef.current = [...swappedOutRef.current, ...broken];
          throw new Error(
            broken.length > 1
              ? `As fotos de ${broken.length} produtos sorteados não carregaram. Toque em Trocar de novo.`
              : "A foto do produto sorteado não carregou. Toque em Trocar de novo.",
          );
        }

        swappedOutRef.current = [...swappedOutRef.current, ...replacements.keys()];

        const selected = swaps.reduce((total, { leaving }) => total + leaving.length, 0);
        const kept = selected - replacements.size;
        if (kept > 0) {
          toast({
            title: `${replacements.size} de ${selected} trocados`,
            description:
              kept === 1
                ? "Um produto ficou: não há outro do mesmo tipo neste tema para pôr no lugar."
                : `${kept} produtos ficaram: não há outros do mesmo tipo neste tema para pôr no lugar.`,
          });
        }
        return result;
      });
      // Os marcados saíram da peça (ou não têm substituto): a marcação acabou.
      if (done) setSelectedIds([]);
    },
    [piece, draw, run, toast],
  );

  /** Redesenha a mesma peça com o título que está no campo. */
  const applyTitle = useCallback(async () => {
    if (!piece) return;
    await run(piece.format.noun, (report) => draw(piece, title, piece.products, [], report));
  }, [piece, draw, run, title]);

  /**
   * Avisa o servidor de que a peça SAIU do admin. É o que faz o próximo sorteio
   * evitar os mesmos produtos e o que alimenta o histórico.
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

  // A peça na tela é do tema e do formato que estão nos campos? Com outro tema
  // ou outro formato selecionado, o que está nos campos é o PRÓXIMO sorteio.
  const pieceMatchesFields =
    piece !== null && theme?.key === piece.theme.key && format.key === piece.format.key;

  return {
    formats: FORMATS,
    format,
    selectFormat: setFormatKey,
    themes,
    isLoadingThemes: themesQuery.isLoading,
    themesFailed: themesQuery.isError,
    theme,
    selectTheme,
    title,
    setTitle: setTypedTitle,
    /** A peça da tela foi gerada com o formato dos campos: o botão principal vira "Sortear de novo". */
    pieceMatchesFormat: piece !== null && format.key === piece.format.key,
    /** O campo diz uma coisa e a peça impressa, outra: falta redesenhar. */
    titleChanged: pieceMatchesFields && (normalizeTitle(title) || piece.theme.title) !== piece.title,
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
    generate,
    /** Os produtos da peça marcados para a próxima troca. */
    selectedIds,
    toggleSelected,
    clearSelection,
    swap,
    applyTitle,
    share,
    download,
  };
}

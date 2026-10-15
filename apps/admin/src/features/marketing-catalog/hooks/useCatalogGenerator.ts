import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drawCatalog, useGetCatalogThemes } from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { preloadPiece } from "../lib/buildPiece";
import { ROLE_CODE, toCatalogProducts } from "../lib/catalogProducts";
import { CATALOG_FORMATS, DEFAULT_FORMAT, FORMAT_ORDER } from "../lib/formats";
import { groupSwapsByRole, matchReplacements } from "../lib/swapPlan";
import { buildThemeOptions, DEFAULT_THEME_KEY } from "../lib/themes";
import { normalizeTitle } from "../template/text";
import type { CatalogFormat, CatalogProduct } from "../types";
import { usePieceSession } from "./usePieceSession";

export type { GeneratedPiece, GeneratorStatus } from "./usePieceSession";

const FORMATS = FORMAT_ORDER.map((key) => CATALOG_FORMATS[key]);

/**
 * Estado e ações da aba Automático do catálogo de divulgação.
 *
 * A pessoa escolhe o formato e o tema, ajusta o título e gera; o servidor
 * sorteia e o navegador desenha. Depois dá para sortear tudo de novo, trocar os
 * produtos marcados ou reescrever o título — os dois últimos redesenham a MESMA
 * peça, no formato em que ela foi gerada.
 *
 * Gerar, prévia, compartilhar e histórico são de `usePieceSession`, o mesmo
 * caminho da aba Personalizado.
 */
export function useCatalogGenerator() {
  const { toast } = useToast();
  const themesQuery = useGetCatalogThemes();
  const session = usePieceSession();
  const { piece, run, draw } = session;

  const themes = useMemo(() => buildThemeOptions(themesQuery.data ?? []), [themesQuery.data]);

  const [formatKey, setFormatKey] = useState<CatalogFormat>(DEFAULT_FORMAT);
  const [themeKey, setThemeKey] = useState(DEFAULT_THEME_KEY);
  // `null` = a pessoa não mexeu: vale o título sugerido pelo tema.
  const [typedTitle, setTypedTitle] = useState<string | null>(null);
  // Quem a pessoa marcou na lista para trocar, na ordem dos toques.
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const format = CATALOG_FORMATS[formatKey];
  const theme = themes.find((option) => option.key === themeKey) ?? themes[0];
  const title = typedTitle ?? theme?.title ?? "";

  // Quem já foi trocado nesta peça não volta na troca seguinte.
  const swappedOutRef = useRef<number[]>([]);

  useEffect(() => {
    // Renderizador, fontes e artes começam a baixar enquanto a pessoa lê a tela.
    preloadPiece();
  }, []);

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
    status: session.status,
    piece,
    /** Em que página o desenho está. Só o catálogo em PDF tem mais de uma. */
    progress: session.progress,
    /** O nome do que está sendo desenhado, para o aviso da moldura. */
    busyNoun: session.busyNoun,
    errorMessage: session.errorMessage,
    isGenerating: session.isGenerating,
    /** O aparelho abre a folha de compartilhamento com arquivo (celular)? */
    canShare: session.canShare,
    generate,
    /** Os produtos da peça marcados para a próxima troca. */
    selectedIds,
    toggleSelected,
    clearSelection,
    swap,
    applyTitle,
    share: session.share,
    download: session.download,
  };
}

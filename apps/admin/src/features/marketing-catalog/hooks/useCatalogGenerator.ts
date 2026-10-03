import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { drawCatalog, useGetCatalogThemes } from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { buildStoryBanner, preloadStoryBanner } from "../lib/buildStoryBanner";
import { ROLE_CODE, toCatalogProducts } from "../lib/catalogProducts";
import { bannerFileName, canShareFile, downloadFile, shareFile } from "../lib/share";
import { buildThemeOptions, DEFAULT_THEME_KEY, type CatalogThemeOption } from "../lib/themes";
import { STORY_MAX_PRODUCTS } from "../template/geometry";
import { normalizeTitle } from "../template/text";
import type { CatalogProduct } from "../types";

/** Reservas pedidas ao sorteio, para o produto de foto fora do ar ceder a vaga. */
const SPARE_CANDIDATES = 4;

export type GeneratorStatus = "idle" | "generating" | "ready" | "error";

/** O banner pronto: o arquivo, a URL da prévia, quem saiu nele e com que título. */
export interface GeneratedBanner {
  file: File;
  previewUrl: string;
  products: CatalogProduct[];
  /** O título impresso — pode já não ser o do campo, se a pessoa mexeu nele. */
  title: string;
  /** O tema do sorteio: é dele que sai a troca de um produto. */
  theme: CatalogThemeOption;
}

/**
 * Estado e ações da tela do catálogo de divulgação.
 *
 * A pessoa escolhe o tema, ajusta o título e gera; o servidor sorteia e o
 * navegador desenha. Depois dá para sortear tudo de novo, trocar um produto só
 * ou reescrever o título — os dois últimos redesenham a MESMA peça.
 */
export function useCatalogGenerator() {
  const { toast } = useToast();
  const themesQuery = useGetCatalogThemes();

  const themes = useMemo(() => buildThemeOptions(themesQuery.data ?? []), [themesQuery.data]);

  const [themeKey, setThemeKey] = useState(DEFAULT_THEME_KEY);
  // `null` = a pessoa não mexeu: vale o título sugerido pelo tema.
  const [typedTitle, setTypedTitle] = useState<string | null>(null);
  const [status, setStatus] = useState<GeneratorStatus>("idle");
  const [banner, setBanner] = useState<GeneratedBanner | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const theme = themes.find((option) => option.key === themeKey) ?? themes[0];
  const title = typedTitle ?? theme?.title ?? "";

  // Cada geração tem um número. Quem toca duas vezes só quer a última: a
  // resposta atrasada da primeira não pode cobrir a segunda.
  const runRef = useRef(0);
  // Quem já foi trocado nesta peça não volta na troca seguinte.
  const swappedOutRef = useRef<number[]>([]);

  // A URL da prévia segura o arquivo na memória; solta ao trocar e ao sair.
  useEffect(() => {
    if (!banner) return;
    return () => URL.revokeObjectURL(banner.previewUrl);
  }, [banner]);

  useEffect(() => {
    // Renderizador, fontes e artes começam a baixar enquanto a pessoa lê a tela.
    preloadStoryBanner();

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
   */
  const run = useCallback(
    async (work: () => Promise<Omit<GeneratedBanner, "previewUrl"> | null>) => {
      const current = ++runRef.current;
      setStatus("generating");
      setErrorMessage(null);

      try {
        const result = await work();
        if (current !== runRef.current) return;

        if (result) setBanner({ ...result, previewUrl: URL.createObjectURL(result.file) });
        setStatus("ready");
      } catch (error) {
        if (current !== runRef.current) return;

        const message = error instanceof Error ? error.message : "Erro desconhecido ao gerar o banner.";
        setErrorMessage(message);
        setStatus("error");
        toast({ variant: "destructive", title: "Não foi possível gerar o banner", description: message });
      }
    },
    [toast],
  );

  /** Desenha a peça com exatamente estes produtos (mais as reservas, se houver). */
  const draw = useCallback(
    async (
      option: CatalogThemeOption,
      heading: string,
      products: CatalogProduct[],
      reserves: CatalogProduct[] = [],
    ) => {
      const date = new Date();
      const printed = normalizeTitle(heading) || option.title;
      const result = await buildStoryBanner({
        title: printed,
        candidates: [...products, ...reserves],
        count: products.length,
        date,
      });

      return {
        file: new File([result.blob], bannerFileName(printed, date), { type: "image/jpeg" }),
        products: result.products,
        title: printed,
        theme: option,
      };
    },
    [],
  );

  const selectTheme = useCallback((key: string) => {
    setThemeKey(key);
    // Tema novo, título sugerido novo: o que a pessoa digitou era do outro tema.
    setTypedTitle(null);
  }, []);

  /** Sorteia uma peça nova no tema escolhido. */
  const generate = useCallback(async () => {
    if (!theme) return;

    await run(async () => {
      // Sem cache de propósito: o preço vai IMPRESSO na peça e tem de ser o de agora.
      const drawn = await drawCatalog({
        theme: theme.theme,
        departmentId: theme.departmentId,
        count: STORY_MAX_PRODUCTS,
        spare: SPARE_CANDIDATES,
      });

      const products = toCatalogProducts(drawn.items);
      if (products.length === 0) {
        throw new Error("Este tema não tem produto com foto e saldo para montar o banner.");
      }

      swappedOutRef.current = [];
      return draw(theme, title, products, toCatalogProducts(drawn.reserves));
    });
  }, [draw, run, theme, title]);

  /** Troca UM produto da peça por outro do mesmo papel, mantendo os demais. */
  const swap = useCallback(
    async (productGroupId: number) => {
      if (!banner) return;

      const leaving = banner.products.find((product) => product.productGroupId === productGroupId);
      if (!leaving) return;

      await run(async () => {
        const inPiece = banner.products.map((product) => product.productGroupId);
        const drawn = await drawCatalog({
          theme: banner.theme.theme,
          departmentId: banner.theme.departmentId,
          count: 1,
          role: ROLE_CODE[leaving.role],
          excludeGroupIds: [...inPiece, ...swappedOutRef.current],
        });

        const [replacement] = toCatalogProducts(drawn.items);
        if (!replacement) {
          toast({
            title: "Sem outro produto",
            description: "Não há outro produto neste tema para pôr no lugar.",
          });
          return null;
        }

        const products = banner.products.map((product) =>
          product.productGroupId === productGroupId ? replacement : product,
        );
        const result = await draw(banner.theme, banner.title, products);

        // Aqui não há reserva para ceder a vaga: se a foto do substituto não
        // carregou, o montador o descartou e a peça voltaria com um produto a
        // menos, em silêncio. A troca não é aplicada, e o substituto de foto
        // quebrada entra na lista para não ser sorteado de novo.
        if (result.products.length < products.length) {
          swappedOutRef.current = [...swappedOutRef.current, replacement.productGroupId];
          throw new Error("A foto do produto sorteado não carregou. Toque em Trocar de novo.");
        }

        swappedOutRef.current = [...swappedOutRef.current, productGroupId];
        return result;
      });
    },
    [banner, draw, run, toast],
  );

  /** Redesenha a mesma peça com o título que está no campo. */
  const applyTitle = useCallback(async () => {
    if (!banner) return;
    await run(() => draw(banner.theme, title, banner.products));
  }, [banner, draw, run, title]);

  const share = useCallback(async () => {
    if (!banner) return;

    const outcome = await shareFile(banner.file);
    if (outcome === "downloaded") {
      toast({
        title: "Banner salvo",
        description: "O arquivo foi para a pasta de downloads deste aparelho.",
      });
    }
  }, [banner, toast]);

  const download = useCallback(() => {
    if (banner) downloadFile(banner.file);
  }, [banner]);

  return {
    themes,
    isLoadingThemes: themesQuery.isLoading,
    themesFailed: themesQuery.isError,
    theme,
    selectTheme,
    title,
    setTitle: setTypedTitle,
    /** O campo diz uma coisa e a peça impressa, outra: falta redesenhar. */
    titleChanged:
      banner !== null &&
      // Com outro tema selecionado, o título do campo é o do PRÓXIMO sorteio,
      // e não uma correção da peça que está na tela.
      theme?.key === banner.theme.key &&
      (normalizeTitle(title) || banner.theme.title) !== banner.title,
    status,
    banner,
    errorMessage,
    isGenerating: status === "generating",
    /** O aparelho abre a folha de compartilhamento com arquivo (celular)? */
    canShare: banner ? canShareFile(banner.file) : false,
    generate,
    swap,
    applyTitle,
    share,
    download,
  };
}

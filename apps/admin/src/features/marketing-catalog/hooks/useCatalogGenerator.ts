import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetStorefrontProductsPageQueryKey, getStorefrontProductsPage } from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { buildStoryBanner, preloadStoryBanner } from "../lib/buildStoryBanner";
import { createSeededRandom, pickStoryProducts } from "../lib/pickProducts";
import { bannerFileName, canShareFile, downloadFile, shareFile } from "../lib/share";
import { STORY_MAX_PRODUCTS } from "../template/geometry";
import type { CatalogProduct } from "../types";

/** O tema da etapa 1. A escolha de tema entra com a API de sorteio (etapa 2). */
export const STORY_TITLE = "Novidades e promoções";

/** Quantos cadastros da vitrine entram no sorteio: os mais recentes e as ofertas. */
const CANDIDATE_POOL = 60;

/** Candidatos a mais, para o produto de foto fora do ar ceder a vaga. */
const SPARE_CANDIDATES = 4;

export type GeneratorStatus = "idle" | "generating" | "ready" | "error";

/** O banner pronto: o arquivo, a URL da prévia e quem saiu nele. */
export interface GeneratedBanner {
  file: File;
  previewUrl: string;
  products: CatalogProduct[];
}

/**
 * Estado e ações da tela do catálogo de divulgação.
 *
 * Etapa 1 (`PLANO-CATALOGO.md`): um formato (banner 9:16) e um tema (novidades
 * e promoções), com os produtos sorteados da vitrine pública. O objetivo é
 * provar o molde e a geração no celular; tema, PDF e o sorteio do servidor vêm
 * nas etapas seguintes.
 */
export function useCatalogGenerator() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<GeneratorStatus>("idle");
  const [banner, setBanner] = useState<GeneratedBanner | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cada geração tem um número. Quem toca duas vezes em "Sortear de novo" só
  // quer o último: a resposta atrasada da primeira não pode cobrir a segunda.
  const runRef = useRef(0);

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

  const generate = useCallback(async () => {
    const run = ++runRef.current;
    setStatus("generating");
    setErrorMessage(null);

    try {
      const params = { size: CANDIDATE_POOL };
      const page = await queryClient.fetchQuery({
        queryKey: [...getGetStorefrontProductsPageQueryKey(), params],
        queryFn: () => getStorefrontProductsPage(params),
        // O preço vai IMPRESSO na peça: tem de ser o de agora, nunca o do cache.
        staleTime: 0,
      });

      const candidates = pickStoryProducts(
        page.data,
        STORY_MAX_PRODUCTS,
        createSeededRandom(Date.now()),
        SPARE_CANDIDATES,
      );
      if (candidates.length === 0) {
        throw new Error("Não há produto com foto na vitrine para montar o banner.");
      }

      const date = new Date();
      const result = await buildStoryBanner({
        title: STORY_TITLE,
        candidates,
        count: STORY_MAX_PRODUCTS,
        date,
      });
      if (run !== runRef.current) return;

      const file = new File([result.blob], bannerFileName(STORY_TITLE, date), { type: "image/jpeg" });
      setBanner({ file, previewUrl: URL.createObjectURL(file), products: result.products });
      setStatus("ready");
    } catch (error) {
      if (run !== runRef.current) return;

      const message = error instanceof Error ? error.message : "Erro desconhecido ao gerar o banner.";
      setErrorMessage(message);
      setStatus("error");
      toast({ variant: "destructive", title: "Não foi possível gerar o banner", description: message });
    }
  }, [queryClient, toast]);

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
    status,
    banner,
    errorMessage,
    isGenerating: status === "generating",
    /** O aparelho abre a folha de compartilhamento com arquivo (celular)? */
    canShare: banner ? canShareFile(banner.file) : false,
    generate,
    share,
    download,
  };
}

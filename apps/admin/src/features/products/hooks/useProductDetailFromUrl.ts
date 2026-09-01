import { useEffect, useRef, useState } from "react";
import { useToast } from "@workspace/ui";
import { getProductsPage } from "@/services/products.service";
import { buildProductCollections } from "@/services/mappers";
import {
  useAllCategories,
  useAllDepartments,
  useAllImages,
  useAllProductGroups,
  useAllProductImages,
  useAllProductTags,
  useAllTags,
} from "@/hooks/use-catalog";
import { PARAM_DETALHE } from "./useProductDetailHistory";

/**
 * Abre a tela de detalhe de quem chega em `/produtos?id=<id do grupo>`.
 *
 * O `?id=` é escrito pelo `useProductDetailHistory` enquanto o detalhe está
 * aberto; este hook é o caminho de VOLTA — recarregar a página ou colar o link
 * em outra aba reabre o produto em vez de deixar a pessoa na listagem
 * procurando o id que a barra de endereços prometia.
 *
 * Não confundir com o link do PDV (`?busca=&editar=`, ver `useProductDeepLink`):
 * aquele abre pela LINHA da tabela porque precisa do filtro para paginar; este
 * busca o grupo direto no servidor, porque o id já é conhecido e a página onde
 * a linha estaria não interessa.
 */

/** Id pedido na URL, lido UMA vez na montagem — a instrução é de uma vez só. */
function idInicialDaUrl(): number | null {
  if (typeof window === "undefined") return null;
  const bruto = new URLSearchParams(window.location.search).get(PARAM_DETALHE);
  if (bruto === null) return null;

  const id = Number(bruto);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Tira o `?id=` da barra de endereços preservando o resto. */
function limparParametro(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(PARAM_DETALHE)) return;

  url.searchParams.delete(PARAM_DETALHE);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

type UseProductDetailFromUrlParams = {
  /** `openDetail` do `useProductEditor`. */
  openDetail: (product?: unknown) => void;
};

export function useProductDetailFromUrl({ openDetail }: UseProductDetailFromUrlParams): void {
  const [idPedido] = useState(idInicialDaUrl);
  const jaResolvido = useRef(false);
  const { toast } = useToast();

  const productGroups = useAllProductGroups();
  const categories = useAllCategories();
  const departments = useAllDepartments();
  const tags = useAllTags();
  const productTags = useAllProductTags();
  const images = useAllImages();
  const productImages = useAllProductImages();

  const catalogs = [productGroups, categories, departments, tags, productTags, images, productImages];
  const catalogsProntos = catalogs.every((query) => !query.isLoading);

  useEffect(() => {
    if (idPedido === null || jaResolvido.current || !catalogsProntos) return;

    let cancelado = false;
    jaResolvido.current = true;

    (async () => {
      try {
        // `?productGroupId=` vem ordenado por id decrescente: o primeiro é o
        // produto representante — o mesmo que a linha da tabela mostraria.
        const page = await getProductsPage({ productGroupId: idPedido, page: 1, limit: 1 });
        if (cancelado) return;

        if (page.data.length === 0) {
          limparParametro();
          toast({
            title: "Produto não encontrado",
            description: "O id da URL não corresponde a nenhum produto.",
            variant: "destructive",
          });
          return;
        }

        const { enrichedProducts } = buildProductCollections({
          products: page.data,
          productGroups: productGroups.data ?? [],
          categories: categories.data ?? [],
          departments: departments.data ?? [],
          tags: tags.data ?? [],
          productTags: productTags.data ?? [],
          images: images.data ?? [],
          productImages: productImages.data ?? [],
        });

        // O `?id=` fica na URL: a entrada corrente passa a ser a do detalhe e o
        // `useProductDetailHistory` a adota sem empurrar outra.
        openDetail(enrichedProducts[0]);
      } catch {
        if (cancelado) return;
        limparParametro();
      }
    })();

    return () => {
      cancelado = true;
    };
    // `openDetail` é estável (declaração de função do hook) e os catálogos entram
    // pelos chaves de query, não pela identidade dos arrays.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idPedido, catalogsProntos, openDetail, toast]);
}

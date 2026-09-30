import { useState } from "react";
import { useGetProductSales } from "@workspace/api-client-react";

/** Linhas por página da aba. É um recorte dentro do cadastro, não a tela de Vendas. */
export const PRODUCT_SALES_PAGE_SIZE = 10;

/**
 * Saídas de UM produto: as vendas que o contêm, da mais recente para a mais
 * antiga, e a venda escolhida para abrir por inteiro.
 *
 * Alimenta a aba **Vendas** da tela de detalhe do produto. A ordenação é do
 * backend (data da VENDA decrescente e, no empate, id do item decrescente): uma
 * venda retroativa ou migrada cai no dia em que vendeu, não no topo.
 *
 * Trocar de produto (outra variação no seletor) volta para a página 1: a página
 * 3 de uma variação com trinta vendas não existe na irmã com cinco, e a aba
 * ficaria vazia sem dizer por quê. A página é guardada JUNTO do produto a que
 * pertence, e não zerada num efeito — o efeito renderizaria a página velha do
 * produto novo por um ciclo (e o lint recusa `setState` dentro de efeito).
 */
export function useProductSales(productId: number | null) {
  const [pageOf, setPageOf] = useState<{ productId: number | null; page: number }>({ productId, page: 1 });
  const [viewSaleId, setViewSaleId] = useState<number | null>(null);

  const page = pageOf.productId === productId ? pageOf.page : 1;
  const setPage = (next: number) => setPageOf({ productId, page: next });

  const { data, isLoading, isError } = useGetProductSales(productId, {
    page,
    limit: PRODUCT_SALES_PAGE_SIZE,
  });

  return {
    page,
    setPage,
    sales: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    isError,
    viewSaleId,
    openSale: (saleId: number) => setViewSaleId(saleId),
    closeSale: () => setViewSaleId(null),
  };
}

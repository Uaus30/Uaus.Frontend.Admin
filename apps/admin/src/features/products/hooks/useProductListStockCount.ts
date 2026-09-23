import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { describeApiError } from "@workspace/core";
import { getProductById } from "@/services/products.service";
import { useAllSuppliers } from "@/hooks/use-catalog";
import { useStockCount } from "@/features/inventory-count/hooks/useStockCount";
import type { ProductTableRow } from "../types";

/**
 * Observação gravada no documento quando a pessoa não escreve nenhuma. É o que
 * diz, meses depois, de onde veio a entrada ou a baixa.
 */
export const LIST_STOCK_COUNT_NOTE = "Contagem de estoque pela listagem de produtos.";

/** A linha tem um SKU que dá para contar? Grupo recém-criado, sem produto, não tem. */
export function canCountStock(row: ProductTableRow): boolean {
  return row.variations.length > 0 || row.id > 0;
}

/**
 * O SKU que a contagem alcança: o produto simples, a única variação, ou a
 * variação ESCOLHIDA. Com duas ou mais, não há padrão — contar na variação
 * errada lança sobra numa e falta noutra, e o erro só aparece na próxima
 * contagem das duas.
 */
export function stockCountTargetId(row: ProductTableRow, pickedVariationId: number | null): number | null {
  if (row.variations.length === 0) return row.id > 0 ? row.id : null;
  if (row.variations.length === 1) return row.variations[0].id;
  return row.variations.some((variation) => variation.id === pickedVariationId) ? pickedVariationId : null;
}

/**
 * "Contagem de estoque" pelo menu da listagem de produtos (pedido do dono,
 * 23/09/2026): a correção pontual sem abrir o cadastro. É a MESMA contagem da
 * aba Estoque — mesmo endpoint, mesmo `useStockCount`, mesma modal —, só que
 * aberta pela linha, que é um GRUPO.
 *
 * **O saldo é relido a cada abertura.** A prévia ("faltam 2 — sai como baixa")
 * é a promessa do documento que vai ser gerado, e o servidor calcula a diferença
 * com o saldo DELE. Com um saldo velho a prévia diria "falta" e o servidor
 * gravaria uma sobra — e, com ela, reativaria um produto Inativo. Por isso abrir
 * (e trocar de variação) invalida a consulta do SKU, e a modal só libera quando
 * essa leitura termina — nunca com o que estiver no cache.
 *
 * Só Administrador: quem decide é a página, que só passa o `openFor` à tabela
 * para ele — e a API recusa o resto com 403.
 */
export function useProductListStockCount() {
  const queryClient = useQueryClient();
  const [row, setRow] = useState<ProductTableRow | null>(null);
  const [pickedVariationId, setPickedVariationId] = useState<number | null>(null);

  const productId = row ? stockCountTargetId(row, pickedVariationId) : null;

  const productQuery = useQuery({
    queryKey: ["product-for-entry", productId],
    enabled: productId !== null,
    queryFn: () => getProductById(productId as number),
    // A leitura é por abertura, e não por foco de janela: com a modal fechada,
    // a consulta que ficou montada não tem por que ir ao servidor sozinha.
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  // `isFetching` cobre as duas formas de a leitura nova começar: a invalidação
  // da mesma chave (reabrir a mesma linha) e a troca de chave com o cache velho.
  const fresh = productQuery.data !== undefined && !productQuery.isFetching && !productQuery.isError;
  const product = fresh ? productQuery.data : undefined;

  const currentStock = productId !== null && product ? product.stock : null;
  const count = useStockCount(productId, currentStock, { defaultNotes: LIST_STOCK_COUNT_NOTE });

  // Só com a modal aberta: a listagem abre com UMA requisição (README, seção 0),
  // e o catálogo de fornecedores só serve à sobra de quem está contando.
  const { data: suppliers = [] } = useAllSuppliers({ enabled: count.open });

  const variation = row?.variations.find((item) => item.id === productId);

  /** Lê o SKU de novo: o que estiver no cache não vale para a contagem. */
  function reload(targetId: number | null) {
    if (targetId !== null) void queryClient.invalidateQueries({ queryKey: ["product-for-entry", targetId] });
  }

  return {
    count,
    suppliers,
    /** As variações a escolher; vazia quando não há escolha a fazer. */
    variationChoices: row && row.variations.length > 1 ? row.variations : [],
    pickedVariationId,
    /** Nome composto da variação alcançada; o do grupo enquanto nenhuma foi escolhida. */
    productName: variation?.name ?? row?.name ?? "",
    barcode: product?.barcode ?? null,
    currentStock,
    ready: productId !== null && currentStock !== null,
    /** A leitura do saldo falhou (rede, ou variação excluída depois da listagem carregar). */
    loadError:
      productId !== null && productQuery.isError && !productQuery.isFetching
        ? describeApiError(productQuery.error, "Confira a conexão e tente de novo.")
        : null,
    retryLoad: () => reload(productId),

    /** Abre a contagem da linha. Fornecedor e custo em branco: o servidor herda os do último lote. */
    openFor(target: ProductTableRow) {
      setRow(target);
      setPickedVariationId(null);
      reload(stockCountTargetId(target, null));
      count.openCount(null, null);
    },

    /**
     * Troca de variação apaga o que foi digitado para a outra: o número contado,
     * e o fornecedor e o custo da sobra, que são de outro lote. A observação fica.
     */
    pickVariation(variationId: number) {
      setPickedVariationId(variationId);
      count.updateForm({ counted: "", supplierId: "", unitCost: "" });
      reload(variationId);
    },
  };
}

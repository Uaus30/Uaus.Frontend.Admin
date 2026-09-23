/**
 * Correção do custo da ÚLTIMA entrada de um produto
 * (`PUT /PurchaseEntries/{id}/items/{itemId}/unit-cost`).
 *
 * O custo não fica só na nota: o backend refaz, na mesma transação, o lote, o
 * custo congelado nas vendas e nas baixas que já consumiram o lote, o custo do
 * cadastro e o cache do painel. Quantidade, datas, preço e o valor das vendas
 * não mudam — e a compra que lançou a nota também não (é o que foi pago).
 */

import type { UseMutationOptions } from "@tanstack/react-query";
import { apiPut, ApiError, useCrudMutation } from "../client";

export interface CorrectPurchaseEntryItemCostRequest {
  /** O custo unitário certo. Zero é aceito (bonificação). Arredondado ao centavo no servidor. */
  unitCost: number;
}

/** Um fechamento financeiro assinado que cobre vendas refeitas. */
export interface CostCorrectionClosingDto {
  id: number;
  periodStart: string;
  periodEnd: string;
}

export interface PurchaseEntryCostCorrectionDto {
  entryId: number;
  itemId: number;
  productId: number;
  previousUnitCost: number;
  unitCost: number;
  /** Falso quando o custo informado já era o gravado: nada foi escrito. */
  changed: boolean;
  /** Itens de venda com custo e lucro refeitos. */
  saleItemsUpdated: number;
  /** Itens de baixa com o custo refeito. */
  writeOffItemsUpdated: number;
  /** A compra que lançou a nota. Os totais dela não mudam. */
  purchaseId?: number | null;
  /** Fechamentos assinados que cobrem vendas refeitas — o CMV deles fica com o custo antigo. */
  affectedClosings: CostCorrectionClosingDto[];
}

export type CorrectPurchaseEntryItemCostVariables = {
  entryId: number;
  itemId: number;
  data: CorrectPurchaseEntryItemCostRequest;
};

export function useCorrectPurchaseEntryItemCost(options?: {
  mutation?: UseMutationOptions<
    PurchaseEntryCostCorrectionDto,
    ApiError,
    CorrectPurchaseEntryItemCostVariables
  >;
}) {
  return useCrudMutation(async ({ entryId, itemId, data }: CorrectPurchaseEntryItemCostVariables) => {
    const response = await apiPut<PurchaseEntryCostCorrectionDto>(
      `/PurchaseEntries/${entryId}/items/${itemId}/unit-cost`,
      data,
    );
    if (!response.data) throw new Error("Não foi possível obter o resultado da correção.");
    return response.data;
  }, options);
}

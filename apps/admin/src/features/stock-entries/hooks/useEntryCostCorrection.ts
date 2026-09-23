import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import {
  getGetPurchaseEntriesQueryKey,
  getGetPurchaseEntryDetailsQueryKey,
  getGetStockWriteOffsQueryKey,
  getProductAnomaliesQueryKey,
  useCorrectPurchaseEntryItemCost,
} from "@workspace/api-client-react";
import { RESOURCE_KEYS } from "@/hooks/use-catalog";
import { describeAffectedClosings, describeCostCorrectionResult } from "../lib/cost-correction";

/** O que a modal pede: qual item de qual nota, e o custo certo. */
export type CostCorrectionPayload = { entryId: number; itemId: number; unitCost: number };

/**
 * Correção do custo da última entrada, pelo detalhe da entrada na aba Estoque
 * (decisão do dono, 23/09/2026).
 *
 * Mora à parte do `useProductStockEntries` porque é outra operação — e ele já
 * está no limite de tamanho de arquivo.
 *
 * A promessa REJEITA quando o servidor recusa: é o que mantém aberta a
 * confirmação (`ConfirmDialog`) para o operador tentar de novo sem refazer o
 * caminho até a linha. O toast de erro sai daqui.
 */
export function useEntryCostCorrection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useCorrectPurchaseEntryItemCost();

  async function correctUnitCost({ entryId, itemId, unitCost }: CostCorrectionPayload): Promise<void> {
    try {
      const resultado = await mutateAsync({ entryId, itemId, data: { unitCost } });

      // O custo mudou em tudo que a nota alimenta: o espelho aberto, a listagem
      // de entradas (custo por linha), o produto de TODAS as variações da nota
      // (custo do cadastro e margem — a nota de uma compra com grade traz um item
      // por variação, e a aba só mostra uma), as baixas que consumiram o lote e a
      // tela de anomalias, onde o "custo zerado" deve sumir.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetPurchaseEntryDetailsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetPurchaseEntriesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: ["product-for-entry"] }),
        queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.products }),
        queryClient.invalidateQueries({ queryKey: getGetStockWriteOffsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getProductAnomaliesQueryKey() }),
      ]);

      toast({ title: "Custo corrigido", description: describeCostCorrectionResult(resultado) });

      const fechamentos = describeAffectedClosings(resultado);
      if (fechamentos)
        toast({ title: "Fechamento assinado não muda", description: fechamentos, variant: "warning" });
    } catch (error) {
      toast({
        title: "Erro ao corrigir o custo",
        description: describeApiError(error, "Não foi possível corrigir o custo desta entrada."),
        error,
        variant: "destructive",
      });
      throw error;
    }
  }

  return { correctUnitCost, isCorrectingCost: isPending };
}

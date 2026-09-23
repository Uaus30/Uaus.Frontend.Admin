import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { describeApiError, formatQuantity } from "@workspace/core";
import {
  getGetPurchaseEntriesQueryKey,
  getGetStockWriteOffsQueryKey,
  registerStockCount,
  type ProductDto,
  type StockCountResultDto,
} from "@workspace/api-client-react";

import { RESOURCE_KEYS } from "@/hooks/use-catalog";
import { announceReactivatedProducts, reactivationBetween } from "@/lib/product-reactivation";

/** O rascunho da contagem. Tudo texto: são campos de formulário. */
export type StockCountForm = {
  /** Vazio é "ainda não digitou" — e não zero, que é resposta legítima da contagem. */
  counted: string;
  supplierId: string;
  unitCost: string;
  notes: string;
};

function emptyForm(): StockCountForm {
  return { counted: "", supplierId: "", unitCost: "", notes: "" };
}

/**
 * A contagem física de uma variação.
 *
 * O operador informa **o que existe na prateleira**, não a diferença: contar é
 * o que ele acabou de fazer, e pedir a diferença seria pedir uma conta de
 * cabeça — a mesma conta que o servidor faz sem errar. O documento sai do
 * backend: entrada de ajuste quando sobra, baixa de inventário quando falta.
 *
 * Fornecedor e custo só aparecem no formulário quando SOBRA, porque só a sobra
 * vira lote. Deixados em branco, o servidor herda o fornecedor do lote mais
 * recente e o custo atual do produto.
 *
 * `defaultNotes` é a observação gravada quando a pessoa não escreve nenhuma. Sem
 * ela, o servidor grava "Contagem física da conferência de produtos." — e quem
 * investigar depois uma contagem feita pela listagem de produtos procuraria uma
 * conferência que não existiu.
 */
export function useStockCount(
  productId: number | null,
  currentStock: number | null,
  options: { defaultNotes?: string } = {},
) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<StockCountForm>(emptyForm);

  const counted = form.counted.trim() === "" ? null : Number(form.counted);
  const countedIsValid = counted !== null && Number.isInteger(counted) && counted >= 0;
  /** Positivo é sobra, negativo é falta. `null` enquanto não há número válido. */
  const difference = countedIsValid && currentStock !== null ? counted - currentStock : null;

  const mutation = useMutation({
    mutationFn: () =>
      registerStockCount(productId!, {
        countedQuantity: counted!,
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        unitCost: form.unitCost.trim() !== "" ? Number(form.unitCost) : null,
        notes: form.notes.trim() || options.defaultNotes || null,
      }),
    onSuccess: async (result) => {
      // O produto como estava ANTES: o reenvio da mesma contagem volta com
      // diferença zero e sem a lista, e só a comparação revela a reativação.
      const before = queryClient.getQueryData<ProductDto>(["product-for-entry", productId]);
      await invalidate();
      const after = queryClient.getQueryData<ProductDto>(["product-for-entry", productId]);
      setOpen(false);
      setForm(emptyForm());
      toast(descreverResultado(result));
      announceReactivatedProducts(result.reactivatedProducts ?? reactivationBetween(before, after));
    },
    onError: (error: unknown) =>
      toast({
        title: "Não foi possível registrar a contagem",
        description: describeApiError(error, "Confira os dados e tente novamente."),
        error,
        variant: "destructive",
      }),
  });

  /**
   * Recarrega tudo que a contagem mexe.
   *
   * São os mesmos alvos de uma entrada — a contagem grava um documento de
   * estoque como qualquer outro — mais as baixas, porque a falta sai por lá.
   */
  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetPurchaseEntriesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetStockWriteOffsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: ["product-for-entry", productId] }),
      queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.products }),
    ]);
  }

  function updateForm(patch: Partial<StockCountForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function openCount(suggestedSupplierId?: number | null, suggestedUnitCost?: number | null) {
    setForm({
      ...emptyForm(),
      supplierId: suggestedSupplierId ? String(suggestedSupplierId) : "",
      unitCost: suggestedUnitCost != null && suggestedUnitCost > 0 ? String(suggestedUnitCost) : "",
    });
    setOpen(true);
  }

  return {
    open,
    setOpen,
    form,
    updateForm,
    openCount,
    counted,
    countedIsValid,
    difference,
    isSaving: mutation.isPending,
    submit: () => mutation.mutate(),
  };
}

/** O aviso diz o que foi GRAVADO, não "salvo com sucesso": são três desfechos diferentes. */
function descreverResultado(result: StockCountResultDto) {
  if (result.difference === 0) {
    return {
      title: "Estoque confere",
      description: `A contagem bateu com as ${formatQuantity(result.countedStock)} unidades do sistema. Nada foi lançado.`,
    };
  }

  const sobra = result.difference > 0;
  return {
    title: sobra ? "Sobra lançada como entrada" : "Falta lançada como baixa",
    description:
      `${formatQuantity(Math.abs(result.difference))} ${sobra ? "a mais" : "a menos"} que o sistema. ` +
      `O saldo de ${result.productName} passou de ${formatQuantity(result.previousStock)} para ` +
      `${formatQuantity(result.countedStock)}.`,
  };
}

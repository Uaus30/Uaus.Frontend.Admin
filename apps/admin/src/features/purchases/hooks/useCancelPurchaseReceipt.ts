import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import {
  cancelPurchaseReceipt,
  getGetLowStockQueryKey,
  getGetPurchaseEntriesQueryKey,
  getGetPurchaseEntryDetailsQueryKey,
  getGetPurchaseReceiptCancellationQueryKey,
  getGetPurchasesQueryKey,
  useGetPurchaseReceiptCancellation,
  type PurchaseDto,
} from "@workspace/api-client-react";
import { RESOURCE_KEYS } from "@/hooks/use-catalog";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";

/** A compra cujo recebimento vai ser cancelado: o id e o nome que a confirmação mostra. */
export type ReceiptCancellationTarget = Pick<PurchaseDto, "id" | "productName">;

/** O que quem abre a confirmação quer saber dela. */
type StartOptions = {
  /**
   * O operador desistiu ("Voltar", Esc, clique fora) — nunca depois do
   * cancelamento. É como o rodapé da compra a reabre: a modal dela fechou para a
   * confirmação abrir, e desistir não pode largar o operador na lista.
   */
  onDismiss?: () => void;
};

/**
 * "Cancelar recebimento" de uma compra lançada (23/10/2026, pedido do dono).
 *
 * Abre a confirmação, busca a **prévia** do servidor — o que sai do estoque, se
 * dá para cancelar e, se não, por quê — e confirma. A regra mora toda no
 * backend: a tela não tenta adivinhar se o lote foi consumido nem se o produto
 * nasceu no recebimento.
 *
 * **O produto criado pelo recebimento sai junto por padrão.** Quem cancela um
 * recebimento de produto novo quase sempre o faz porque o CADASTRO saiu errado
 * (código trocado, produto duplicado de um que já existia); manter o cadastro
 * deixaria a compra presa a ele, e o recebimento seguinte cairia de novo no
 * mesmo produto. A caixa continua lá para quem errou só a quantidade ou o custo.
 *
 * Confirmado, `onCancelled` recebe a compra já "A caminho" — a tela de Compras
 * a abre em edição, que é onde se troca o produto antes de receber de novo.
 */
export function useCancelPurchaseReceipt({
  onCancelled,
}: { onCancelled?: (purchase: PurchaseDto) => void } = {}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [target, setTarget] = useState<ReceiptCancellationTarget | null>(null);
  // `null` é "o operador não mexeu na caixa": vale o padrão, que é excluir.
  const [deleteChoice, setDeleteChoice] = useState<boolean | null>(null);
  const dismissRef = useRef<(() => void) | undefined>(undefined);
  // O `isPending` da mutação chega à tela um quadro depois do clique: dois
  // cliques no mesmo quadro passariam pelos dois. A ref vale na hora.
  const sendingRef = useRef(false);

  const preview = useGetPurchaseReceiptCancellation(target?.id ?? null);
  useApiErrorToast(preview.isError, preview.error);
  // A prévia que falhou — inclusive a releitura depois de uma recusa, que deixa o
  // dado velho na tela — não sustenta o botão: a confirmação mostra o erro.
  const previewError = preview.isError
    ? describeApiError(preview.error, "Não foi possível ler o recebimento desta compra.")
    : null;

  const generated = preview.data?.generatedProduct;
  const deleteGeneratedProduct = generated?.canDelete === true && (deleteChoice ?? true);

  /**
   * Tudo o que um cancelamento mexe: a compra (lista e resumo do painel), o
   * produto (saldo, custo e preço) e o catálogo de grupos de onde o produto
   * excluído sai, a aba Estoque dele (as entradas e o espelho da nota que acabou de
   * sair) e o estoque baixo, de onde a compra volta a contar como "a caminho".
   *
   * A PRÉVIA fica de fora: a compra deixou de estar lançada, e relê-la só traria um
   * 400 do servidor para o console — ela sai do cache quando a confirmação fecha.
   */
  function invalidate() {
    const previa = getGetPurchaseReceiptCancellationQueryKey()[1];
    return Promise.all([
      queryClient.invalidateQueries({
        queryKey: getGetPurchasesQueryKey(),
        predicate: (query) => query.queryKey[1] !== previa,
      }),
      queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.products }),
      queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.productGroups }),
      queryClient.invalidateQueries({ queryKey: getGetPurchaseEntriesQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetPurchaseEntryDetailsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: ["product-for-entry"] }),
      queryClient.invalidateQueries({ queryKey: getGetLowStockQueryKey() }),
    ]);
  }

  const mutation = useMutation({
    mutationFn: (variables: { id: number; deleteGeneratedProduct: boolean }) =>
      cancelPurchaseReceipt(variables.id, { deleteGeneratedProduct: variables.deleteGeneratedProduct }),
    onSuccess: async (purchase, variables) => {
      await invalidate();
      // Cancelou: não é desistência, e quem abre a compra é o `onCancelled`.
      dismissRef.current = undefined;
      setTarget(null);
      setDeleteChoice(null);
      toast({
        title: "Recebimento cancelado",
        description: variables.deleteGeneratedProduct
          ? "O estoque foi desfeito, o produto criado no recebimento foi excluído e a compra voltou para A caminho como produto novo."
          : "O estoque foi desfeito e a compra voltou para A caminho.",
      });
      onCancelled?.(purchase);
    },
    onError: (error: unknown, variables) => {
      toast({
        title: "Erro ao cancelar o recebimento",
        description: describeApiError(error, "Tente novamente."),
        error,
        variant: "destructive",
      });
      // A recusa quase sempre é o estado ter mudado desde a prévia (uma unidade
      // vendida, a conferência aberta): recarregada, a confirmação passa a mostrar
      // o motivo no lugar do botão, em vez de deixá-lo clicável para outra recusa.
      void queryClient.invalidateQueries({
        queryKey: [...getGetPurchaseReceiptCancellationQueryKey(), variables.id],
      });
    },
    onSettled: () => {
      sendingRef.current = false;
    },
  });

  function start(purchase: ReceiptCancellationTarget, options?: StartOptions) {
    dismissRef.current = options?.onDismiss;
    setDeleteChoice(null);
    setTarget({ id: purchase.id, productName: purchase.productName });
  }

  /** Fechar no meio do cancelamento deixaria o operador sem saber se ele saiu. */
  function close() {
    if (mutation.isPending || sendingRef.current) return;
    const onDismiss = dismissRef.current;
    dismissRef.current = undefined;
    setTarget(null);
    setDeleteChoice(null);
    onDismiss?.();
  }

  /** Com a prévia recarregando ou com erro, o que está na tela pode já não valer. */
  function confirm() {
    if (!target || preview.data?.canCancel !== true || preview.isFetching || preview.isError) return;
    if (mutation.isPending || sendingRef.current) return;
    sendingRef.current = true;
    mutation.mutate({ id: target.id, deleteGeneratedProduct });
  }

  return {
    /** A compra com a confirmação aberta, ou nulo. */
    target,
    preview: preview.data,
    isLoadingPreview: preview.isLoading,
    /** A prévia falhou: a frase que a confirmação mostra no lugar do botão. */
    previewError,
    /** A prévia está sendo relida (depois de uma recusa): o botão espera por ela. */
    isRefreshingPreview: preview.isFetching,
    /** Excluir também o produto criado no recebimento — só verdadeiro quando ele pode sair. */
    deleteGeneratedProduct,
    setDeleteGeneratedProduct: (value: boolean) => setDeleteChoice(value),
    start,
    close,
    confirm,
    isCancelling: mutation.isPending,
  };
}

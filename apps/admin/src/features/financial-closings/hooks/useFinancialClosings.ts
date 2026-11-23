import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  deleteFinancialClosing,
  getGetCapitalContributionsQueryKey,
  getGetFinancialClosingByIdQueryKey,
  getGetFinancialClosingsQueryKey,
  getGetPurchaseBudgetQueryKey,
  useGetFinancialClosingById,
  useGetFinancialClosings,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import type { FinancialClosingDto } from "../types";

/** Tamanho fixo da página da listagem. */
export const PAGE_SIZE = 10;

/**
 * useFinancialClosings
 *
 * A listagem paginada de todos os fechamentos (mais recentes primeiro, sem
 * filtro) e o diálogo de detalhe com a exclusão. O novo fechamento mora em
 * `useNewClosing`.
 *
 * Só o ÚLTIMO fechamento pode ser excluído (corrente de saldos): excluir um do
 * meio deixaria o seguinte com um saldo inicial que não existe mais. A tela só
 * oferece o botão no último (`isLatest`); o servidor recusa os outros dizendo
 * qual excluir antes.
 */
export function useFinancialClosings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ─── Listagem (todos os fechamentos, do mais recente para o mais antigo) ───
  const [page, setPage] = useState(1);

  const { data: closingsPage, isLoading, refetch } = useGetFinancialClosings({ page, limit: PAGE_SIZE });

  // Excluir o último item da última página deixaria a tela presa numa página
  // vazia — quando a página atual deixa de existir, recua para a última.
  useEffect(() => {
    const totalPages = closingsPage?.totalPages;
    if (totalPages != null && totalPages >= 1 && page > totalPages) setPage(totalPages);
  }, [closingsPage?.totalPages, page]);

  // ─── Detalhe + exclusão ────────────────────────────────────────────────────
  const [detailsId, setDetailsId] = useState<number | null>(null);

  const { data: closingDetails, isLoading: isLoadingDetails } = useGetFinancialClosingById(
    detailsId ?? undefined,
  );

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFinancialClosing(id),
    onSuccess: async (_data, id) => {
      // O documento não existe mais — o cache do detalhe sai junto. O prefixo
      // dos fechamentos alcança a listagem e o `next` (o mês volta a aguardar);
      // a faixa perde o saldo inicial e o mês volta a aceitar aporte.
      queryClient.removeQueries({ queryKey: [...getGetFinancialClosingByIdQueryKey(), id] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetFinancialClosingsQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetPurchaseBudgetQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetCapitalContributionsQueryKey() }),
      ]);
      toast({
        title: "Fechamento excluído",
        description: "O mês voltou a aguardar fechamento, e o seguinte volta a esperar por ele.",
      });
      setDetailsId(null);
    },
    onError: (error: unknown) => {
      // "Só o último fechamento pode ser excluído: exclua antes o de {mês/ano}."
      toast({
        title: "Erro ao excluir o fechamento",
        description: describeApiError(error),
        error,
        variant: "destructive",
      });
    },
  });

  /**
   * Exclui um fechamento. Devolve a Promise da mutação porque o `ConfirmDialog`
   * do detalhe só fecha quando ela resolve: falhando, ele permanece aberto com o
   * erro no toast, em vez de sumir sem dizer se o documento saiu.
   */
  function handleDeleteClosing(closing: FinancialClosingDto) {
    return deleteMutation.mutateAsync(closing.id);
  }

  return {
    // Listagem
    closings: closingsPage?.data ?? [],
    closingsPage,
    isLoading,
    refetch,
    page,
    setPage,

    // Detalhe + exclusão
    detailsId,
    closingDetails,
    isLoadingDetails,
    isDeleting: deleteMutation.isPending,
    openDetails: (id: number) => setDetailsId(id),
    closeDetails: () => setDetailsId(null),
    handleDeleteClosing,
  };
}

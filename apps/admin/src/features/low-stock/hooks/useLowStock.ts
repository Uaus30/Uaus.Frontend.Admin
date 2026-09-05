import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce, useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import {
  getGetLowStockQueryKey,
  reopenLowStock,
  resolveLowStock,
  useGetLowStock,
  useGetLowStockSummary,
} from "@workspace/api-client-react";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import type { LowStockItem, LowStockSummary } from "../types";

/** Linhas por página do relatório. */
export const PAGE_SIZE = 20;

export interface LowStockState {
  search: string;
  setSearch: (value: string) => void;
  includeResolved: boolean;
  setIncludeResolved: (value: boolean) => void;
  page: number;
  setPage: (value: number) => void;
  totalPages: number;
  total: number;
  items: LowStockItem[];
  isLoading: boolean;
  isFetching: boolean;
  summary: LowStockSummary | undefined;
  resolve: (productId: number) => void;
  reopen: (productId: number) => void;
  /** Produto cuja marca está sendo gravada agora — a linha mostra o spinner. */
  mutatingProductId: number | null;
}

/**
 * Relatório de estoque baixo: lista, contagem e o "resolvido" por item.
 *
 * ## O que "resolvido" quer dizer
 *
 * O produto continua abaixo do mínimo — a marca não mexe em estoque. Ela diz
 * "já tratei" (pedido feito ao fornecedor, item que vai ser descontinuado) e
 * tira o item da contagem que acende o alerta vermelho do painel, SEM tirá-lo
 * do relatório. A marca cai sozinha na próxima entrada de estoque do produto:
 * entrada nova é situação nova, e o saldo volta a ser avaliado.
 *
 * Trocar a busca ou o filtro de resolvidos volta para a primeira página nos
 * próprios setters, e não num efeito: manter a página 3 de um recorte maior
 * mostraria "nenhum item" para um relatório que tem itens.
 */
export function useLowStock(): LowStockState {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearchState] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [includeResolved, setIncludeResolvedState] = useState(false);
  const [page, setPage] = useState(1);

  const list = useGetLowStock({
    includeResolved,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  });
  useApiErrorToast(list.isError, list.error);

  const summary = useGetLowStockSummary();

  function setSearch(value: string) {
    setSearchState(value);
    setPage(1);
  }

  function setIncludeResolved(value: boolean) {
    setIncludeResolvedState(value);
    setPage(1);
  }

  /**
   * Invalida o PREFIXO do recurso: lista (todas as páginas e filtros) e
   * contagem de uma vez. Sem isso o relatório atualizaria e o alerta do painel
   * continuaria vermelho até um F5.
   */
  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: getGetLowStockQueryKey() });
  }

  const resolveMutation = useMutation({
    mutationFn: (productId: number) => resolveLowStock(productId),
    onSuccess: async () => {
      await invalidate();
      toast({
        title: "Alerta resolvido",
        description: "O produto sai do alerta até a próxima entrada de estoque.",
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao resolver o alerta",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    },
  });

  const reopenMutation = useMutation({
    mutationFn: (productId: number) => reopenLowStock(productId),
    onSuccess: async () => {
      await invalidate();
      toast({ title: "Alerta reaberto", description: "O produto voltou a contar como pendente." });
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao reabrir o alerta",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    },
  });

  const mutatingProductId = resolveMutation.isPending
    ? (resolveMutation.variables ?? null)
    : reopenMutation.isPending
      ? (reopenMutation.variables ?? null)
      : null;

  return {
    search,
    setSearch,
    includeResolved,
    setIncludeResolved,
    page,
    setPage,
    totalPages: list.data?.totalPages ?? 1,
    total: list.data?.total ?? 0,
    items: list.data?.data ?? [],
    isLoading: list.isLoading,
    isFetching: list.isFetching,
    summary: summary.data,
    resolve: (productId) => resolveMutation.mutate(productId),
    reopen: (productId) => reopenMutation.mutate(productId),
    mutatingProductId,
  };
}

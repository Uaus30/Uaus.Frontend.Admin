import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebounce, useToast } from "@workspace/ui";
import {
  enumCode,
  finishInventoryCount,
  getGetInventoryCountsQueryKey,
  getGetStockFreezeStatusQueryKey,
  INVENTORY_COUNT_STATUS,
  reviewInventoryCountProduct,
  startInventoryCount,
  useGetCurrentInventoryCount,
  useGetInventoryCountItems,
  useGetLastInventoryCount,
  type InventoryCountDto,
  type InventoryCountStartMode,
} from "@workspace/api-client-react";
import { describeApiError } from "@workspace/core";

import { useAllCategories } from "@/hooks/use-catalog";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";
import { productDetailFromCountPathname } from "../lib/product-conference-link";
import type { InventoryCountState, InventoryCountStatusFilter } from "../types";

/**
 * A aba de Conferência de Produtos.
 *
 * ## O que a tela precisa saber
 *
 * Existem dois modos e uma pergunta só decide entre eles: **há conferência
 * aberta?** (`GET /InventoryCounts/current`, que responde 204 quando não há).
 * Sem conferência, a aba é um convite a começar; com conferência, é a lista do
 * que falta.
 *
 * ## Por que a lista abre nos PENDENTES
 *
 * É o pedido do dono e é o que faz a conferência terminar: marcar um item o tira
 * da tela, então a lista encolhe até acabar. Os conferidos continuam a um clique
 * de distância, no filtro de situação — desmarcar um item errado precisa de
 * caminho de volta.
 *
 * ## O encerramento chega pela resposta, não por consulta
 *
 * `reviewInventoryCountProduct` devolve a conferência já recontada. Quando o
 * item marcado era o último, ela volta com status **Encerrada** — e é dali que
 * sai o aviso de conclusão. Perguntar de novo ao servidor abriria uma janela em
 * que a tela mostra "0 pendentes" com a conferência ainda aberta.
 */
export function useInventoryCount(): InventoryCountState {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [search, setSearchState] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [categoryId, setCategoryIdState] = useState("all");
  const [statusFilter, setStatusFilterState] = useState<InventoryCountStatusFilter>("pending");
  const [onlyWithoutImage, setOnlyWithoutImageState] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(20);
  const [finishAsked, setFinishAsked] = useState(false);
  const [reviewingGroupId, setReviewingGroupId] = useState<number | null>(null);

  const currentQuery = useGetCurrentInventoryCount();
  useApiErrorToast(currentQuery.isError, currentQuery.error);

  const count = currentQuery.data ?? null;

  // Só sem conferência aberta: é o que a tela de abertura oferece para
  // "continuar de onde parou". Sem reconsulta ao voltar à aba — só muda quando
  // uma rodada se encerra, e quem encerra invalida.
  const lastQuery = useGetLastInventoryCount({
    query: { enabled: currentQuery.isSuccess && !count, refetchOnWindowFocus: false },
  });
  useApiErrorToast(lastQuery.isError, lastQuery.error);

  const itemsQuery = useGetInventoryCountItems(count?.id, {
    search: debouncedSearch || undefined,
    categoryId: categoryId !== "all" ? Number(categoryId) : undefined,
    status: statusFilter,
    onlyWithoutImage,
    page,
    limit: pageSize,
  });
  useApiErrorToast(itemsQuery.isError, itemsQuery.error);

  const { data: categories = [] } = useAllCategories();

  /**
   * Invalida o PREFIXO do recurso: a conferência aberta, todas as páginas da
   * lista e a situação de cada produto de uma vez. Invalidar só a lista deixaria
   * o contador do cabeçalho — e a tarja da tela de produto — no número velho.
   */
  function invalidate() {
    // O congelamento do estoque junto: abrir e encerrar a conferência muda a
    // faixa do topo e o que os botões de entrada deixam fazer, na hora.
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetInventoryCountsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetStockFreezeStatusQueryKey() }),
    ]);
  }

  function reportarErro(title: string, error: unknown) {
    toast({ title, description: describeApiError(error, "Tente novamente."), error, variant: "destructive" });
  }

  const startMutation = useMutation({
    mutationFn: (mode: InventoryCountStartMode) => startInventoryCount(mode),
    onSuccess: async (nova) => {
      await invalidate();
      setStatusFilterState("pending");
      setPage(1);
      toast({
        title: "Conferência iniciada — estoque congelado",
        description: `${nova.totalItems} cadastros entraram na lista. Até você encerrar, o PDV não vende e entradas, baixas e cancelamentos ficam pausados.`,
      });
    },
    onError: (error: unknown) => reportarErro("Não foi possível iniciar a conferência", error),
  });

  const finishMutation = useMutation({
    mutationFn: (id: number) => finishInventoryCount(id),
    onSuccess: async (encerrada) => {
      await invalidate();
      setFinishAsked(false);
      toast({
        title: "Conferência encerrada — vendas liberadas",
        description: `${encerrada.reviewedItems} de ${encerrada.totalItems} cadastros foram conferidos. O que faltou continua na próxima rodada.`,
      });
    },
    onError: (error: unknown) => reportarErro("Não foi possível encerrar a conferência", error),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ productGroupId, reviewed }: { productGroupId: number; reviewed: boolean }) =>
      reviewInventoryCountProduct(productGroupId, reviewed),
    onSuccess: async (atualizada, variables) => {
      await invalidate();
      avisarResultado(atualizada, variables.reviewed);
    },
    onError: (error: unknown) => reportarErro("Não foi possível registrar a conferência", error),
    onSettled: () => setReviewingGroupId(null),
  });

  /**
   * O aviso depende do que aconteceu: desmarcar é rotina, marcar o último
   * ENCERRA a conferência — e isso não pode passar como mais um clique.
   */
  function avisarResultado(atualizada: InventoryCountDto, reviewed: boolean) {
    if (!reviewed) {
      toast({
        title: "Produto devolvido à lista",
        description: "Ele volta a aparecer entre os pendentes.",
      });
      return;
    }

    if (enumCode(atualizada.status, INVENTORY_COUNT_STATUS) === INVENTORY_COUNT_STATUS.Finished) {
      toast({
        title: "Conferência concluída!",
        description: `Todos os ${atualizada.totalItems} cadastros foram conferidos. A conferência foi encerrada e as vendas estão liberadas.`,
      });
      return;
    }

    toast({
      title: "Produto conferido",
      description: `Faltam ${atualizada.pendingItems} de ${atualizada.totalItems}.`,
    });
  }

  // Todo filtro volta para a primeira página: a página 7 do filtro anterior
  // costuma não existir no novo, e a tela cairia vazia sem explicação. O reset
  // é feito em cada setter, e não num efeito — `setState` síncrono dentro de
  // efeito dispara render em cascata, e o lint do repositório recusa.

  function setSearch(value: string) {
    setSearchState(value);
    setPage(1);
  }

  function setCategoryId(value: string) {
    setCategoryIdState(value);
    setPage(1);
  }

  function setStatusFilter(value: InventoryCountStatusFilter) {
    setStatusFilterState(value);
    setPage(1);
  }

  function setOnlyWithoutImage(value: boolean) {
    setOnlyWithoutImageState(value);
    setPage(1);
  }

  function setPageSize(size: number) {
    setPageSizeState(size);
    setPage(1);
  }

  function review(productGroupId: number, reviewed: boolean) {
    setReviewingGroupId(productGroupId);
    reviewMutation.mutate({ productGroupId, reviewed });
  }

  function confirmFinish() {
    if (count) finishMutation.mutate(count.id);
  }

  /**
   * Leva ao detalhe do produto — a conferência não edita nada por conta
   * própria. Foto, nome, preço, variações e estoque já têm uma tela só, e
   * duplicá-la aqui seria a segunda a divergir.
   *
   * O caminho vai carimbado como vindo da conferência: lá, marcar "conferido"
   * devolve o operador para esta lista, que é onde ele pega o próximo.
   */
  function openProduct(productGroupId: number) {
    navigate(productDetailFromCountPathname(productGroupId));
  }

  return {
    count,
    // A tela de abertura espera a última rodada: antes dela, o "Continuar de
    // onde parou" ainda não existe, e um clique rápido recomeçaria do zero. O
    // `isFetching` cobre também o fim de uma rodada, quando o cache ainda traz
    // a anterior à recém-encerrada.
    isLoadingCount: currentQuery.isLoading || (count === null && lastQuery.isFetching),
    items: itemsQuery.data?.data ?? [],
    total: itemsQuery.data?.total ?? 0,
    isLoadingItems: itemsQuery.isLoading,
    isFetchingItems: itemsQuery.isFetching,
    search,
    setSearch,
    categoryId,
    setCategoryId,
    statusFilter,
    setStatusFilter,
    onlyWithoutImage,
    setOnlyWithoutImage,
    page,
    setPage,
    pageSize,
    setPageSize,
    categories,
    lastCount: lastQuery.data ?? null,
    start: (mode: InventoryCountStartMode) => startMutation.mutate(mode),
    startingMode: startMutation.isPending ? (startMutation.variables ?? null) : null,
    askFinish: () => setFinishAsked(true),
    finishAsked,
    cancelFinish: () => setFinishAsked(false),
    confirmFinish,
    isFinishing: finishMutation.isPending,
    review,
    reviewingGroupId,
    openProduct,
  };
}

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  enumCode,
  getGetStockWriteOffsQueryKey,
  STOCK_WRITE_OFF_STATUS,
  useGetStockWriteOffs,
  useGetUsers,
  type StockWriteOffDto,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import {
  buildStockWriteOffQuery,
  EMPTY_STOCK_WRITE_OFF_FILTERS,
  fetchStockWriteOffDetails,
  submitStockWriteOff,
  submitStockWriteOffReversal,
} from "@/services/stock-write-offs.service";
import type {
  ProductSearchOption,
  StockWriteOffDraftItem,
  StockWriteOffFilterState,
} from "../types";

const PAGE_SIZE = 15;

/** Chave da consulta de detalhes de uma baixa. */
export const getStockWriteOffDetailsQueryKey = (id: number | null) => ["stock-write-off-details", id];

/**
 * Uma baixa só pode ser estornada enquanto está efetivada.
 *
 * O status chega como número ou como o nome do membro em C#, daí o `enumCode`.
 */
export function isReversibleWriteOff(writeOff: StockWriteOffDto): boolean {
  return enumCode(writeOff.status, STOCK_WRITE_OFF_STATUS) === STOCK_WRITE_OFF_STATUS.Confirmed;
}

/**
 * useStockWriteOffs
 *
 * Concentra listagem com filtros, detalhamento, registro e estorno das baixas
 * de estoque. A tela só liga controles a este hook.
 */
export function useStockWriteOffs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<StockWriteOffFilterState>(EMPTY_STOCK_WRITE_OFF_FILTERS);

  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [reversalTarget, setReversalTarget] = useState<StockWriteOffDto | null>(null);
  const [reversalReason, setReversalReason] = useState("");

  // Rascunho do modal de registro
  const [draftReason, setDraftReason] = useState("");
  const [draftItems, setDraftItems] = useState<StockWriteOffDraftItem[]>([]);
  const [draftNotes, setDraftNotes] = useState("");

  const query = useMemo(
    () => buildStockWriteOffQuery(filters, { page, limit: PAGE_SIZE }),
    [filters, page],
  );

  const { data: writeOffsPage, isLoading } = useGetStockWriteOffs(query);

  // Operadores para o filtro "quem registrou". A loja tem poucos usuários, então
  // a lista inteira cabe numa página e não vale uma busca assíncrona.
  const { data: usersPage } = useGetUsers({ page: 1, limit: 100 });
  const users = usersPage?.data ?? [];

  // A listagem não traz os itens; eles chegam só na consulta por ID.
  const { data: writeOffDetails, isLoading: isLoadingDetails } = useQuery({
    queryKey: getStockWriteOffDetailsQueryKey(detailsId),
    queryFn: () => fetchStockWriteOffDetails(detailsId as number),
    enabled: detailsId != null,
  });

  /**
   * Troca um filtro e volta para a primeira página — manter a página atual
   * mostraria "nenhum resultado" só porque o novo recorte é menor.
   */
  function setFilter<K extends keyof StockWriteOffFilterState>(
    key: K,
    value: StockWriteOffFilterState[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  /** Aplica o período escolhido no calendário (as duas pontas de uma vez). */
  function setPeriod(startDate: string, endDate: string) {
    setFilters((current) => ({ ...current, startDate, endDate }));
    setPage(1);
  }

  /** Volta todos os filtros ao estado inicial. */
  function clearFilters() {
    setFilters(EMPTY_STOCK_WRITE_OFF_FILTERS);
    setPage(1);
  }

  function resetDraft() {
    setDraftReason("");
    setDraftItems([]);
    setDraftNotes("");
  }

  /** Abre o modal de registro com o rascunho limpo. */
  function openRegisterModal() {
    resetDraft();
    setRegisterModalOpen(true);
  }

  /**
   * Coloca o produto no rascunho. Escolher o mesmo produto de novo soma na linha
   * existente em vez de duplicá-la.
   */
  function addDraftItem(product: ProductSearchOption, quantity = 1) {
    setDraftItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (existing) {
        return current.map((item) =>
          item.productId === product.id ? { ...item, quantity: item.quantity + quantity } : item,
        );
      }

      return [
        ...current,
        {
          productId: product.id,
          productName: product.name,
          barcode: product.barcode,
          stock: product.stock,
          quantity,
        },
      ];
    });
  }

  /** Ajusta a quantidade de uma linha do rascunho. */
  function updateDraftItemQuantity(productId: number, quantity: number) {
    setDraftItems((current) =>
      current.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
    );
  }

  /** Remove a linha do rascunho. */
  function removeDraftItem(productId: number) {
    setDraftItems((current) => current.filter((item) => item.productId !== productId));
  }

  const draftTotalQuantity = useMemo(
    () => draftItems.reduce((sum, item) => sum + (Number.isFinite(item.quantity) ? item.quantity : 0), 0),
    [draftItems],
  );

  const registerMutation = useMutation({
    mutationFn: () =>
      submitStockWriteOff({
        reason: Number(draftReason),
        items: draftItems,
        notes: draftNotes,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getGetStockWriteOffsQueryKey() });
      toast({
        title: "Baixa registrada",
        description: "O estoque dos produtos já foi reduzido.",
      });
      setRegisterModalOpen(false);
      resetDraft();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao registrar a baixa",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  const reversalMutation = useMutation({
    mutationFn: async () => {
      if (!reversalTarget) {
        throw new Error("Nenhuma baixa selecionada para estorno.");
      }
      await submitStockWriteOffReversal(reversalTarget.id, reversalReason);
      // O ID vem do alvo, e não da resposta: é ele que identifica a consulta de
      // detalhes que precisa ser invalidada.
      return reversalTarget.id;
    },
    onSuccess: async (reversedId) => {
      await queryClient.invalidateQueries({ queryKey: getGetStockWriteOffsQueryKey() });
      await queryClient.invalidateQueries({
        queryKey: getStockWriteOffDetailsQueryKey(reversedId),
      });
      toast({
        title: "Baixa estornada",
        description: "O estoque foi devolvido e o registro continua no histórico.",
      });
      closeReversal();
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao estornar a baixa",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  /** Submete o rascunho. A validação de motivo e itens vive no service. */
  function handleRegisterSubmit(event: React.FormEvent) {
    event.preventDefault();
    registerMutation.mutate();
  }

  /**
   * Abre a confirmação de estorno. Baixa já estornada não passa daqui — o botão
   * nem aparece na linha, mas a regra não pode depender do render.
   */
  function openReversal(writeOff: StockWriteOffDto) {
    if (!isReversibleWriteOff(writeOff)) {
      toast({
        title: "Esta baixa já foi estornada",
        description: "O estoque dela já voltou; não há o que desfazer.",
        variant: "destructive",
      });
      return;
    }

    setReversalTarget(writeOff);
    setReversalReason("");
  }

  function closeReversal() {
    setReversalTarget(null);
    setReversalReason("");
  }

  return {
    // Listagem
    writeOffs: writeOffsPage?.data ?? [],
    writeOffsPage,
    isLoading,
    page,
    setPage,
    pageSize: PAGE_SIZE,
    filters,
    setFilter,
    setPeriod,
    clearFilters,
    users,

    // Detalhes
    detailsId,
    setDetailsId,
    writeOffDetails,
    isLoadingDetails,

    // Registro
    registerModalOpen,
    setRegisterModalOpen,
    openRegisterModal,
    draftReason,
    setDraftReason,
    draftItems,
    draftNotes,
    setDraftNotes,
    draftTotalQuantity,
    addDraftItem,
    updateDraftItemQuantity,
    removeDraftItem,
    handleRegisterSubmit,
    isRegistering: registerMutation.isPending,

    // Estorno
    reversalTarget,
    openReversal,
    closeReversal,
    reversalReason,
    setReversalReason,
    confirmReversal: () => reversalMutation.mutate(),
    isReversing: reversalMutation.isPending,
  };
}

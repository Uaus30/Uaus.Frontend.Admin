import { useEffect, useState } from "react";
import {
  CASH_REGISTER_SESSION_CLOSED,
  CASH_REGISTER_SESSION_OPEN,
  useGetCashRegisterSessionById,
  useGetCashRegisterSessions,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import type { CashRegisterSessionStatusFilter } from "../types";

/** Tamanho fixo da página da listagem. */
export const PAGE_SIZE = 10;

/**
 * Converte o valor do Select de status no código numérico esperado pela API.
 *
 * "all" vira `undefined` — sem o parâmetro, o backend devolve turnos abertos e
 * fechados.
 */
export function statusFilterToCode(filter: CashRegisterSessionStatusFilter): number | undefined {
  if (filter === "open") return CASH_REGISTER_SESSION_OPEN;
  if (filter === "closed") return CASH_REGISTER_SESSION_CLOSED;
  return undefined;
}

/**
 * useCashRegisterSessions
 *
 * Hook controlador da tela de sessões de caixa (turnos do PDV) — SOMENTE
 * leitura: abertura e fechamento acontecem no PDV; o admin apenas consulta.
 *
 * Responsabilidades:
 * - Listagem paginada com filtros de status e período (`yyyy-MM-dd` — a
 *   conversão Date ↔ string fica no componente, com `parseDateInput`/
 *   `formatDateInput`, padrão SalesTable).
 * - Detalhe da sessão clicada, consultado só com o Dialog aberto.
 * - Aviso via toast quando a listagem falha.
 */
export function useCashRegisterSessions() {
  const { toast } = useToast();

  const [statusFilter, setStatusFilterState] = useState<CashRegisterSessionStatusFilter>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const {
    data: sessionsPage,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetCashRegisterSessions({
    status: statusFilterToCode(statusFilter),
    startDate: startDate || undefined,
    // O backend compara `OpenedAt <= endDate` com hora; enviar só "yyyy-MM-dd"
    // (meia-noite) deixava de fora todo turno aberto no último dia do período.
    // Mesma convenção das vendas e das baixas.
    endDate: endDate ? `${endDate}T23:59:59` : undefined,
    page,
    size: PAGE_SIZE,
  });

  // A tela é só consulta: sem o aviso, uma falha de rede deixaria a lista
  // vazia em silêncio, como se não existisse turno algum.
  useEffect(() => {
    if (!isError) return;
    toast({
      title: "Erro ao carregar as sessões de caixa",
      description: describeApiError(error),
      variant: "destructive",
    });
  }, [isError, error, toast]);

  // O id NÃO é gateado por detailsOpen de propósito: com o gate, fechar o
  // Dialog desabilitava a query e o conteúdo piscava para a mensagem de erro
  // durante o fade-out. O hook do api-client já desabilita a consulta quando
  // o id é indefinido (padrão SaleDetailsModal).
  const { data: selectedSession, isLoading: isLoadingDetails } = useGetCashRegisterSessionById(
    selectedSessionId ?? undefined,
  );

  /** Troca o filtro de status e volta para a primeira página. */
  function setStatusFilter(value: CashRegisterSessionStatusFilter) {
    setStatusFilterState(value);
    setPage(1);
  }

  /**
   * Aplica o período do calendário e volta para a primeira página.
   *
   * @param nextStartDate Início no formato `yyyy-MM-dd` (vazio limpa o filtro).
   * @param nextEndDate Fim no formato `yyyy-MM-dd` (vazio limpa o filtro).
   */
  function setPeriod(nextStartDate: string, nextEndDate: string) {
    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setPage(1);
  }

  /** Abre o Dialog de detalhe da sessão clicada. */
  function openDetails(id: number) {
    setSelectedSessionId(id);
    setDetailsOpen(true);
  }

  /** Fecha o Dialog de detalhe (o id fica para o conteúdo não piscar no fade-out). */
  function closeDetails() {
    setDetailsOpen(false);
  }

  return {
    sessions: sessionsPage?.data ?? [],
    pagination: sessionsPage
      ? {
          page: sessionsPage.page,
          size: sessionsPage.limit,
          filteredItems: sessionsPage.total,
          totalPages: sessionsPage.totalPages,
        }
      : undefined,
    isLoading,
    page,
    setPage,
    statusFilter,
    setStatusFilter,
    startDate,
    endDate,
    setPeriod,
    detailsOpen,
    selectedSessionId,
    selectedSession,
    isLoadingDetails,
    openDetails,
    closeDetails,
    refetch,
  };
}

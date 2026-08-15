import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  createFinancialClosing,
  deleteFinancialClosing,
  getGetFinancialClosingsQueryKey,
  previewFinancialClosing,
  useGetFinancialClosingById,
  useGetFinancialClosings,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { describeApiError } from "@/lib/api-error";
import { formatShortDate } from "@/lib/formatters";
import type { FinancialClosingDto, FinancialClosingPreviewDto, NewClosingStep } from "../types";

/** Tamanho fixo da página da listagem. */
export const PAGE_SIZE = 10;

/** Período congelado junto com a prévia — o que a confirmação envia. */
interface ClosingPeriod {
  periodStart: string;
  periodEnd: string;
}

/**
 * Primeiro e último dia do mês anterior ao de referência, como `yyyy-MM-dd`.
 *
 * Atalho do diálogo de novo fechamento: o fechamento recomendado é sempre o
 * mês-calendário cheio, porque os custos fixos entram por competência mensal
 * (valor cheio de cada mês tocado, sem pró-rata).
 */
export function previousMonthRange(reference: Date = new Date()): {
  periodStart: string;
  periodEnd: string;
} {
  const start = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  // Dia 0 do mês de referência = último dia do mês anterior.
  const end = new Date(reference.getFullYear(), reference.getMonth(), 0);
  return { periodStart: format(start, "yyyy-MM-dd"), periodEnd: format(end, "yyyy-MM-dd") };
}

/**
 * useFinancialClosings
 *
 * Hook controlador da tela de fechamentos financeiros: listagem paginada com
 * filtro de período, diálogo de novo fechamento em dois passos
 * (prévia → confirmação) e diálogo de detalhe com exclusão.
 *
 * A prévia não persiste nada e a confirmação RECALCULA tudo no servidor — os
 * números exibidos aqui são só conferência, nunca viajam de volta na gravação.
 */
export function useFinancialClosings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // ─── Listagem (filtro incide sobre o início do período) ────────────────────
  const [page, setPage] = useState(1);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const {
    data: closingsPage,
    isLoading,
    refetch,
  } = useGetFinancialClosings({
    startDate: filterStartDate || undefined,
    endDate: filterEndDate || undefined,
    page,
    limit: PAGE_SIZE,
  });

  /** Aplica o período do filtro e volta para a primeira página. */
  function handleFilterRangeChange(startDate: string, endDate: string) {
    setFilterStartDate(startDate);
    setFilterEndDate(endDate);
    setPage(1);
  }

  // Excluir o último item da última página deixaria a tela presa numa página
  // vazia — quando a página atual deixa de existir, recua para a última.
  useEffect(() => {
    const totalPages = closingsPage?.totalPages;
    if (totalPages != null && totalPages >= 1 && page > totalPages) setPage(totalPages);
  }, [closingsPage?.totalPages, page]);

  // ─── Novo fechamento (diálogo em 2 passos) ─────────────────────────────────
  const [newClosingOpen, setNewClosingOpen] = useState(false);
  const [step, setStep] = useState<NewClosingStep>("periodo");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<FinancialClosingPreviewDto | null>(null);
  // Período usado na requisição da prévia exibida. A confirmação envia SEMPRE
  // este período congelado — nunca o estado do calendário, que pode ter mudado
  // depois do cálculo.
  const [previewPeriod, setPreviewPeriod] = useState<ClosingPeriod | null>(null);

  /** Abre o diálogo de novo fechamento com o formulário zerado. */
  function openNewClosing() {
    setStep("periodo");
    setPeriodStart("");
    setPeriodEnd("");
    setNotes("");
    setPreview(null);
    setPreviewPeriod(null);
    setNewClosingOpen(true);
  }

  /** Fecha o diálogo de novo fechamento (o estado é zerado na próxima abertura). */
  function closeNewClosing() {
    setNewClosingOpen(false);
  }

  /** Atualiza o período escolhido no calendário (strings `yyyy-MM-dd`). */
  function handlePeriodChange(newPeriodStart: string, newPeriodEnd: string) {
    setPeriodStart(newPeriodStart);
    setPeriodEnd(newPeriodEnd);
  }

  /** Atalho "Mês anterior": preenche o mês-calendário cheio mais recente já encerrado. */
  function applyPreviousMonth() {
    const range = previousMonthRange();
    setPeriodStart(range.periodStart);
    setPeriodEnd(range.periodEnd);
  }

  const previewMutation = useMutation({
    mutationFn: (period: ClosingPeriod) => previewFinancialClosing(period),
    onSuccess: (data, period) => {
      if (!data) return;
      // Congela o período das variables da mutação (o efetivamente enviado),
      // não o estado atual — que pode mudar antes da resposta chegar.
      setPreview(data);
      setPreviewPeriod(period);
      setStep("previa");
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao calcular a prévia",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  /** Dispara o cálculo da prévia; sem período completo, orienta e não chama a API. */
  function handleCalculatePreview() {
    if (!periodStart || !periodEnd) {
      toast({
        title: "Informe o período",
        description: "Selecione o início e o fim do período antes de calcular a prévia.",
        variant: "destructive",
      });
      return;
    }
    previewMutation.mutate({ periodStart, periodEnd });
  }

  /** Volta ao passo do período mantendo as datas — a prévia congelada é descartada. */
  function backToPeriod() {
    setPreview(null);
    setPreviewPeriod(null);
    setStep("periodo");
  }

  const confirmMutation = useMutation({
    mutationFn: (period: ClosingPeriod) =>
      createFinancialClosing({ ...period, notes: notes.trim() || null }),
    onSuccess: async () => {
      // Prefixo da chave ["FinancialClosings", params]: invalida todas as
      // páginas e filtros da listagem de uma vez.
      await queryClient.invalidateQueries({ queryKey: getGetFinancialClosingsQueryKey() });
      toast({
        title: "Fechamento confirmado",
        description: "Os números do período e o rateio dos sócios foram congelados.",
      });
      setNewClosingOpen(false);
    },
    onError: (error: unknown) => {
      // Sobreposição de período e soma de percentuais ≠ 100 chegam por aqui
      // com a mensagem do backend.
      toast({
        title: "Erro ao confirmar o fechamento",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  /**
   * Confirma o fechamento — o servidor recalcula, valida e congela tudo.
   *
   * Sem prévia congelada não há o que confirmar: o período enviado é sempre o
   * da prévia exibida, nunca o estado atual do calendário.
   */
  function handleConfirmClosing() {
    if (!previewPeriod || confirmMutation.isPending) return;
    confirmMutation.mutate(previewPeriod);
  }

  // ─── Detalhe + exclusão ────────────────────────────────────────────────────
  const [detailsId, setDetailsId] = useState<number | null>(null);

  const { data: closingDetails, isLoading: isLoadingDetails } = useGetFinancialClosingById(
    detailsId ?? undefined,
  );

  /** Abre o diálogo de detalhe do fechamento clicado. */
  function openDetails(id: number) {
    setDetailsId(id);
  }

  /** Fecha o diálogo de detalhe. */
  function closeDetails() {
    setDetailsId(null);
  }

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteFinancialClosing(id),
    onSuccess: async (_data, id) => {
      // O documento não existe mais — o cache do detalhe sai junto.
      queryClient.removeQueries({ queryKey: ["financial-closing-details", id] });
      await queryClient.invalidateQueries({ queryKey: getGetFinancialClosingsQueryKey() });
      toast({
        title: "Fechamento excluído",
        description: "O período voltou a ficar livre para um novo fechamento.",
      });
      setDetailsId(null);
    },
    onError: (error: unknown) => {
      toast({
        title: "Erro ao excluir o fechamento",
        description: describeApiError(error),
        variant: "destructive",
      });
    },
  });

  /**
   * Exclui um fechamento após confirmação do usuário.
   *
   * É ação destrutiva de documento — o backend registra em log quem excluiu,
   * e o aviso do confirm deixa isso claro antes de prosseguir.
   */
  function handleDeleteClosing(closing: FinancialClosingDto) {
    const period = `${formatShortDate(closing.periodStart)} — ${formatShortDate(closing.periodEnd)}`;
    const confirmed = window.confirm(
      `Excluir o fechamento do período ${period}?\n\nEsta ação é registrada em log e libera o período para um novo fechamento.`,
    );
    if (!confirmed) return;
    deleteMutation.mutate(closing.id);
  }

  return {
    // Listagem
    closings: closingsPage?.data ?? [],
    closingsPage,
    isLoading,
    refetch,
    page,
    setPage,
    filterStartDate,
    filterEndDate,
    handleFilterRangeChange,

    // Novo fechamento
    newClosingOpen,
    step,
    periodStart,
    periodEnd,
    notes,
    setNotes,
    preview,
    isCalculatingPreview: previewMutation.isPending,
    isSavingClosing: confirmMutation.isPending,
    openNewClosing,
    closeNewClosing,
    handlePeriodChange,
    applyPreviousMonth,
    handleCalculatePreview,
    backToPeriod,
    handleConfirmClosing,

    // Detalhe + exclusão
    detailsId,
    closingDetails,
    isLoadingDetails,
    isDeleting: deleteMutation.isPending,
    openDetails,
    closeDetails,
    handleDeleteClosing,
  };
}

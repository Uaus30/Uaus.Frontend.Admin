import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createFinancialClosing,
  deleteFinancialClosing,
  getGetFinancialClosingsQueryKey,
  previewFinancialClosing,
  useGetFinancialClosingById,
  useGetFinancialClosings,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import {
  buildMonthOptions,
  buildYearOptions,
  closedMonthsOf,
  formatCompetence,
  lastEndedMonth,
  monthRange,
} from "../month-selection";
import type { FinancialClosingDto, FinancialClosingPreviewDto, NewClosingStep } from "../types";

/** Tamanho fixo da página da listagem. */
export const PAGE_SIZE = 10;

/** Teto da consulta que descobre os meses já fechados de um ano. */
const CLOSED_MONTHS_LIMIT = 200;

/** Período congelado junto com a prévia — o que a confirmação envia. */
interface ClosingPeriod {
  periodStart: string;
  periodEnd: string;
}

/**
 * useFinancialClosings
 *
 * Hook controlador da tela de fechamentos financeiros: listagem paginada de
 * todos os fechamentos (mais recentes primeiro, sem filtro), diálogo de novo
 * fechamento em dois passos (competência → prévia → confirmação) e diálogo de
 * detalhe com exclusão.
 *
 * A prévia não persiste nada e a confirmação RECALCULA tudo no servidor — os
 * números exibidos aqui são só conferência, nunca viajam de volta na gravação.
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

  // ─── Novo fechamento (diálogo em 2 passos) ─────────────────────────────────
  const [newClosingOpen, setNewClosingOpen] = useState(false);
  const [step, setStep] = useState<NewClosingStep>("competencia");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<FinancialClosingPreviewDto | null>(null);
  // Período usado na requisição da prévia exibida. A confirmação envia SEMPRE
  // este período congelado — nunca a competência atual, que pode ter mudado
  // depois do cálculo.
  const [previewPeriod, setPreviewPeriod] = useState<ClosingPeriod | null>(null);

  // Fechamentos que podem tocar o ano escolhido, para travar os meses já
  // fechados. A janela começa no ano anterior porque os fechamentos antigos são
  // de período livre: um que comece em dezembro pode invadir janeiro daqui.
  const { data: yearClosings, isLoading: isLoadingMonths } = useGetFinancialClosings(
    {
      startDate: `${year - 1}-01-01`,
      endDate: `${year}-12-31`,
      page: 1,
      limit: CLOSED_MONTHS_LIMIT,
    },
    { query: { enabled: newClosingOpen } },
  );

  const closedMonths = useMemo(
    () => closedMonthsOf(year, yearClosings?.data ?? []),
    [year, yearClosings?.data],
  );
  const monthOptions = useMemo(() => buildMonthOptions(year, closedMonths), [year, closedMonths]);
  const yearOptions = useMemo(() => buildYearOptions(), []);

  /** Abre o diálogo de novo fechamento com o formulário zerado no ano corrente. */
  function openNewClosing() {
    setStep("competencia");
    setYear(new Date().getFullYear());
    setMonth(null);
    setNotes("");
    setPreview(null);
    setPreviewPeriod(null);
    setNewClosingOpen(true);
  }

  /** Fecha o diálogo de novo fechamento (o estado é zerado na próxima abertura). */
  function closeNewClosing() {
    setNewClosingOpen(false);
  }

  /** Troca o ano; o mês volta a ficar em branco porque a disponibilidade é outra. */
  function handleYearChange(newYear: number) {
    setYear(newYear);
    setMonth(null);
  }

  /** Escolhe o mês da competência (1–12). */
  function handleMonthChange(newMonth: number) {
    setMonth(newMonth);
  }

  /** Atalho "Último mês": seleciona o último mês-calendário encerrado. */
  function applyLastMonth() {
    const last = lastEndedMonth();
    setYear(last.year);
    setMonth(last.month);
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

  /** Dispara o cálculo da prévia; sem competência válida, orienta e não chama a API. */
  function handleCalculatePreview() {
    if (month == null) {
      toast({
        title: "Escolha a competência",
        description: "Selecione o mês e o ano do fechamento antes de calcular a prévia.",
        variant: "destructive",
      });
      return;
    }

    // O select já trava o mês fechado; o atalho "Último mês" não passa por ele.
    if (closedMonths.includes(month)) {
      toast({
        title: "Mês já fechado",
        description: `${formatCompetence({ year, month })} já tem fechamento. Exclua o existente para refazer.`,
        variant: "destructive",
      });
      return;
    }

    previewMutation.mutate(monthRange({ year, month }));
  }

  /** Volta ao passo da competência mantendo mês e ano — a prévia congelada é descartada. */
  function backToCompetence() {
    setPreview(null);
    setPreviewPeriod(null);
    setStep("competencia");
  }

  const confirmMutation = useMutation({
    mutationFn: (period: ClosingPeriod) => createFinancialClosing({ ...period, notes: notes.trim() || null }),
    onSuccess: async () => {
      // Prefixo da chave ["FinancialClosings", params]: invalida todas as
      // páginas da listagem e a consulta de meses fechados de uma vez.
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
   * da prévia exibida, nunca a competência atual do formulário.
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
   * Exclui um fechamento.
   *
   * É ação destrutiva de documento — o backend registra em log quem excluiu. O
   * aviso disso é do `ConfirmDialog` do diálogo de detalhe, que é onde o período
   * e o lucro líquido estão na tela. Devolve a Promise da mutação porque o
   * diálogo só fecha quando ela resolve: falhando, ele permanece aberto com o
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

    // Novo fechamento
    newClosingOpen,
    step,
    year,
    month,
    yearOptions,
    monthOptions,
    isLoadingMonths,
    notes,
    setNotes,
    preview,
    isCalculatingPreview: previewMutation.isPending,
    isSavingClosing: confirmMutation.isPending,
    openNewClosing,
    closeNewClosing,
    handleYearChange,
    handleMonthChange,
    applyLastMonth,
    handleCalculatePreview,
    backToCompetence,
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

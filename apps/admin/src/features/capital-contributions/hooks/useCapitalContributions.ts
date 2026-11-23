import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createCapitalContribution,
  deleteCapitalContribution,
  getGetCapitalContributionsQueryKey,
  getGetPurchaseBudgetQueryKey,
  getPurchaseBudget,
  updateCapitalContribution,
  useGetCapitalContributionTotalsByPartner,
  useGetCapitalContributions,
  useGetPartners,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError, toDateKey, toMonthKey } from "@workspace/core";
import { orderByName } from "@/lib/select-options";
import { asksNewContribution, clearNewContributionParam } from "../capital-contributions-route";
import { contributionBandEffect } from "../band-effect";
import type {
  CapitalContributionDto,
  CapitalContributionForm,
  PartnerOption,
  SaveCapitalContributionPayload,
} from "../types";

/** Teto da consulta de sócios para o select — a loja tem dois. */
const PARTNERS_LIMIT = 100;

/** Formulário em branco: o aporte nasce com a data de hoje (componentes LOCAIS). */
function emptyForm(): CapitalContributionForm {
  return { contributionDate: toDateKey(new Date()), partnerId: "", amount: "", notes: "" };
}

/** A faixa de um mês, sem deixar a falha dela derrubar a gravação do aporte. */
function budgetOrNull(month: string) {
  return getPurchaseBudget({ month }).catch(() => null);
}

/**
 * useCapitalContributions
 *
 * Hook controlador da tela de Aportes (`/financeiro/aportes`), no molde de
 * `useFixedCosts`: filtro de mês, os aportes do mês com o total, o acumulado
 * por sócio, a modal de lançamento/edição e a exclusão.
 *
 * Toda mutação invalida os aportes E a faixa de compras: o aporte entra como
 * saldo disponível e sobe as duas linhas (decisão 8). O toast diz o efeito
 * ("Novembro passou de amarelo para verde"), comparando a faixa do mês do
 * aporte antes e depois — as duas lidas direto do servidor, porque o cache da
 * faixa pode nem existir quando a pessoa chega por aqui.
 */
export function useCapitalContributions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [currentMonth] = useState(() => toMonthKey(new Date()));
  const [month, setMonthState] = useState(currentMonth);

  const monthQuery = useGetCapitalContributions({ month });
  const totalsQuery = useGetCapitalContributionTotalsByPartner();
  const partnersQuery = useGetPartners({ includeInactive: false, limit: PARTNERS_LIMIT });

  // O atalho "Lançar aporte" do Painel chega com `?novo=1`: a modal já abre.
  const [modalOpen, setModalOpen] = useState(() => asksNewContribution(window.location.search));
  const [editing, setEditing] = useState<CapitalContributionDto | null>(null);
  const [form, setForm] = useState<CapitalContributionForm>(emptyForm);

  const isClosed = monthQuery.data?.isClosed === true;

  // Sócios ATIVOS, em ordem alfabética (regra dos selects). Na edição, o sócio do
  // aporte entra mesmo inativo: sem ele o select apareceria vazio.
  const activePartners: PartnerOption[] = (partnersQuery.data?.data ?? [])
    .filter((partner) => partner.isActive)
    .map((partner) => ({ id: partner.id, name: partner.name }));
  const partnerOptions = orderByName(
    editing && !activePartners.some((partner) => partner.id === editing.partnerId)
      ? [...activePartners, { id: editing.partnerId, name: editing.partnerName }]
      : activePartners,
    (partner) => partner.name,
  );

  /** Troca o mês do filtro, sem passar do corrente. */
  function setMonth(next: string) {
    setMonthState(next > currentMonth ? currentMonth : next);
  }

  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetCapitalContributionsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetPurchaseBudgetQueryKey() }),
    ]);
  }

  /** Invalida, relê a faixa do mês e diz o efeito do aporte nela. */
  async function announce(title: string, monthKey: string, before: Awaited<ReturnType<typeof budgetOrNull>>) {
    await invalidate();
    const after = await budgetOrNull(monthKey);
    const effect = contributionBandEffect(monthKey, before, after);
    toast({ title, description: effect ?? undefined });
  }

  const saveMutation = useMutation({
    mutationFn: async (input: { id: number | null; payload: SaveCapitalContributionPayload }) => {
      const monthKey = input.payload.contributionDate.slice(0, 7);
      const before = await budgetOrNull(monthKey);
      if (input.id) await updateCapitalContribution(input.id, input.payload);
      else await createCapitalContribution(input.payload);
      return { monthKey, before };
    },
    onSuccess: async ({ monthKey, before }, input) => {
      closeModal();
      await announce(input.id ? "Aporte alterado." : "Aporte lançado.", monthKey, before);
    },
    onError: (error: unknown) => {
      // Mês fechado, sócio inativo e valor inválido chegam com a mensagem do backend.
      toast({
        title: "Erro ao salvar o aporte",
        description: describeApiError(error),
        error,
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (contribution: CapitalContributionDto) => {
      const monthKey = contribution.contributionDate.slice(0, 7);
      const before = await budgetOrNull(monthKey);
      await deleteCapitalContribution(contribution.id);
      return { monthKey, before };
    },
    onSuccess: ({ monthKey, before }) => announce("Aporte excluído.", monthKey, before),
    onError: (error: unknown) => {
      toast({
        title: "Erro ao excluir o aporte",
        description: describeApiError(error),
        error,
        variant: "destructive",
      });
    },
  });

  /** Abre a modal de novo aporte, com a data de hoje. */
  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  }

  /** Abre a modal com o aporte da linha. Mês fechado não edita — o botão já vem travado. */
  function openEdit(contribution: CapitalContributionDto) {
    setEditing(contribution);
    setForm({
      contributionDate: contribution.contributionDate.slice(0, 10),
      partnerId: String(contribution.partnerId),
      amount: String(contribution.amount),
      notes: contribution.notes ?? "",
    });
    setModalOpen(true);
  }

  /** Fecha a modal descartando o que não foi salvo (e tira o `?novo=1` da URL). */
  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    clearNewContributionParam();
  }

  /** Valida e grava. As recusas de regra (mês fechado, sócio inativo) são do servidor. */
  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saveMutation.isPending) return;

    const amount = Number(form.amount);
    if (
      !form.partnerId ||
      !form.contributionDate ||
      !form.amount.trim() ||
      Number.isNaN(amount) ||
      amount <= 0
    ) {
      toast({
        title: "Preencha os campos obrigatórios",
        description: "Informe a data, o sócio e um valor maior que zero.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      id: editing?.id ?? null,
      payload: {
        partnerId: Number(form.partnerId),
        contributionDate: form.contributionDate,
        amount,
        notes: form.notes.trim() || null,
      },
    });
  }

  /**
   * Exclui o aporte. Devolve a Promise porque quem chama é o `ConfirmDialog`,
   * que só fecha quando ela resolve e fica aberto se o servidor recusar.
   */
  function handleDelete(contribution: CapitalContributionDto) {
    return deleteMutation.mutateAsync(contribution);
  }

  return {
    month,
    currentMonth,
    setMonth,
    contributions: monthQuery.data?.items ?? [],
    monthTotal: monthQuery.data?.total ?? 0,
    isClosed,
    isLoading: monthQuery.isLoading,
    partnerTotals: totalsQuery.data ?? [],
    isLoadingTotals: totalsQuery.isLoading,
    partnerOptions,
    modalOpen,
    editing,
    form,
    setForm,
    openCreate,
    openEdit,
    closeModal,
    handleSubmit,
    isSaving: saveMutation.isPending,
    handleDelete,
    isDeleting: deleteMutation.isPending,
  };
}

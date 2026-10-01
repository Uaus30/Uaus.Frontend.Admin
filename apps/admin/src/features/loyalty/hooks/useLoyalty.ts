import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getGetCouponsQueryKey,
  getLoyaltyDashboardQueryKey,
  getLoyaltySettingsQueryKey,
  getLoyaltySummaryQueryKey,
  turnOffLoyalty,
  turnOnLoyalty,
  updateLoyaltySettings,
  useGetCoupons,
  useGetLoyaltyActionCounts,
  useGetLoyaltyActionList,
  useGetLoyaltyCharts,
  useGetLoyaltySettings,
  useGetLoyaltySummary,
  type LoyaltyActionList,
  type LoyaltyRewardStatusFilter,
  type UpdateLoyaltySettingsPayload,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { periodFor } from "../lib/loyalty-form";
import type { LoyaltyPeriodPreset } from "../types";

/**
 * A tela Marketing › Fidelidade (01/10/2026): o estado do programa, a
 * configuração num modal, ligar e desligar, e os números do período.
 *
 * Salvar, ligar e desligar invalidam também a listagem de cupons: é ela que
 * mostra o selo "Gerenciado pelo programa de fidelidade" e trava o cupom
 * associado.
 */
export function useLoyalty() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [preset, setPreset] = useState<LoyaltyPeriodPreset>("all");
  const [configOpen, setConfigOpen] = useState(false);
  const [confirmOffOpen, setConfirmOffOpen] = useState(false);
  const [openAction, setOpenAction] = useState<LoyaltyActionList | null>(null);
  const [rewardStatus, setRewardStatus] = useState<LoyaltyRewardStatusFilter>("available");

  const settings = useGetLoyaltySettings();
  const period = periodFor(preset);
  const summary = useGetLoyaltySummary(period);
  const charts = useGetLoyaltyCharts(period);
  // O "Para agir" é retrato de hoje: não depende do período.
  const actionCounts = useGetLoyaltyActionCounts();
  // O filtro de situação só vale na lista de prêmios esperando troca.
  const actionRows = useGetLoyaltyActionList(
    openAction,
    openAction === "rewards-waiting" ? rewardStatus : undefined,
  );
  // Os cupons que o modal oferece para os prêmios: só com ele aberto.
  const coupons = useGetCoupons({ onlyActive: true, limit: 200 }, { query: { enabled: configOpen } });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getLoyaltySettingsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getLoyaltySummaryQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getLoyaltyDashboardQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getGetCouponsQueryKey() }),
    ]);
  };

  const fail = (title: string) => (error: unknown) =>
    toast({ title, description: describeApiError(error), error, variant: "destructive" });

  const save = useMutation({
    mutationFn: (payload: UpdateLoyaltySettingsPayload) => updateLoyaltySettings(payload),
    onSuccess: async () => {
      await refresh();
      setConfigOpen(false);
      toast({
        title: "Configuração salva",
        description: "O mínimo vale na hora; o resto, para os cartões abertos daqui em diante.",
      });
    },
    onError: fail("Não foi possível salvar a configuração"),
  });

  const turnOn = useMutation({
    mutationFn: turnOnLoyalty,
    onSuccess: async () => {
      await refresh();
      toast({ title: "Programa ligado", description: "As vendas com cliente passam a ganhar carimbo." });
    },
    onError: fail("Não foi possível ligar o programa"),
  });

  const turnOff = useMutation({
    mutationFn: turnOffLoyalty,
    onSuccess: async () => {
      await refresh();
      setConfirmOffOpen(false);
      toast({
        title: "Programa desligado",
        description: "Cartões e prêmios já conquistados ficam guardados.",
      });
    },
    onError: fail("Não foi possível desligar o programa"),
  });

  return {
    settings: settings.data,
    isLoadingSettings: settings.isLoading,
    // Sem a configuração a tela não tem o que mostrar: o erro dela vira o aviso da
    // página inteira, em vez do carregando para sempre.
    isSettingsError: settings.isError,
    retrySettings: () => void settings.refetch(),
    summary: summary.data,
    isLoadingSummary: summary.isLoading,
    isSummaryError: summary.isError,
    retrySummary: () => void summary.refetch(),
    charts: charts.data,
    isLoadingCharts: charts.isLoading,
    isChartsError: charts.isError,
    retryCharts: () => void charts.refetch(),
    actionCounts: actionCounts.data,
    isLoadingActionCounts: actionCounts.isLoading,
    isActionCountsError: actionCounts.isError,
    retryActionCounts: () => void actionCounts.refetch(),
    openAction,
    // Cada lista abre nos disponíveis: o número do card conta só eles.
    setOpenAction: (list: LoyaltyActionList | null) => {
      setRewardStatus("available");
      setOpenAction(list);
    },
    rewardStatus,
    setRewardStatus,
    actionRows: actionRows.data,
    isLoadingActionRows: actionRows.isLoading,
    isActionRowsError: actionRows.isError,
    retryActionRows: () => void actionRows.refetch(),
    coupons: coupons.data?.data ?? [],
    preset,
    setPreset,
    configOpen,
    setConfigOpen,
    confirmOffOpen,
    setConfirmOffOpen,
    save: save.mutate,
    isSaving: save.isPending,
    turnOn: () => turnOn.mutate(),
    isTurningOn: turnOn.isPending,
    turnOff: () => turnOff.mutateAsync().then(() => undefined),
    isTurningOff: turnOff.isPending,
  };
}

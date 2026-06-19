import { useState, useMemo } from "react";
import type { PeriodPreset, PeriodMode } from "../types";

/**
 * useDashboard
 * 
 * Hook customizado para gerenciar estados de datas, períodos (presets e personalizados),
 * e popovers de filtro de tempo do painel geral de faturamento.
 */
export function useDashboard() {
  const [periodMode, setPeriodMode] = useState<PeriodMode>("preset");
  const [period, setPeriod] = useState<PeriodPreset>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [appliedCustomStart, setAppliedCustomStart] = useState("");
  const [appliedCustomEnd, setAppliedCustomEnd] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);

  const periodLabel = useMemo(() => {
    if (periodMode === "custom" && appliedCustomStart && appliedCustomEnd) {
      return `${appliedCustomStart} → ${appliedCustomEnd}`;
    }
    return {
      "7d": "Últimos 7 dias",
      "30d": "Últimos 30 dias",
      "90d": "Últimos 90 dias",
      "1y": "Último ano",
    }[period];
  }, [periodMode, appliedCustomStart, appliedCustomEnd, period]);

  /**
   * Confirma e aplica o intervalo de datas customizado preenchido no popover.
   */
  function handleApplyCustom() {
    if (!customStart || !customEnd) return;
    setAppliedCustomStart(customStart);
    setAppliedCustomEnd(customEnd);
    setPeriodMode("custom");
    setPopoverOpen(false);
  }

  /**
   * Altera o período para um dos intervalos pré-definidos (7d, 30d, 90d, etc).
   */
  function handleSelectPreset(value: string) {
    setPeriod(value as PeriodPreset);
    setPeriodMode("preset");
  }

  return {
    periodMode,
    setPeriodMode,
    period,
    setPeriod,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    appliedCustomStart,
    appliedCustomEnd,
    popoverOpen,
    setPopoverOpen,
    periodLabel,
    handleApplyCustom,
    handleSelectPreset,
  };
}

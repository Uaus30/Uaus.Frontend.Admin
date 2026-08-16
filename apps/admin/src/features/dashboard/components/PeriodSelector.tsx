import React from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { formatDateInput, parseDateInput } from "@workspace/ui";
import { DateRangePicker, type DateRange } from "@workspace/ui";
import { cn } from "@workspace/ui";
import type { PeriodMode, PeriodPreset } from "../types";
import { PERIOD_PRESETS } from "../utils";

/** Rótulo dos campos de filtro — mesmo padrão da barra de filtros dos logs. */
const FILTER_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

type PeriodSelectorProps = {
  periodMode: PeriodMode;
  preset: PeriodPreset;
  /** Rótulo do período em vigor, exibido abaixo do título. */
  periodLabel: string;
  customStart: string;
  setCustomStart: (value: string) => void;
  customEnd: string;
  setCustomEnd: (value: string) => void;
  handleApplyCustom: (start?: string, end?: string) => void;
  handleSelectPreset: (value: string) => void;
  handleClearCustom: () => void;
  isFetching: boolean;
  onRefresh: () => void;
};

/**
 * PeriodSelector
 *
 * Cabeçalho do painel: título, período em vigor e os controles que o mudam.
 *
 * O intervalo personalizado usa o `DateRangePicker` padrão — o próprio calendário
 * já é a camada flutuante, por isso não há popover em volta. O período é aplicado
 * assim que as duas pontas são escolhidas, e por isso `handleApplyCustom` recebe
 * as datas explicitamente: nesse instante o estado do rascunho ainda guarda o
 * valor anterior.
 */
export function PeriodSelector({
  periodMode,
  preset,
  periodLabel,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  handleApplyCustom,
  handleSelectPreset,
  handleClearCustom,
  isFetching,
  onRefresh,
}: PeriodSelectorProps) {
  const customRange: DateRange = {
    from: parseDateInput(customStart),
    to: parseDateInput(customEnd),
  };

  /** Guarda o rascunho e aplica assim que as duas pontas existem. */
  function handleCustomRangeChange(range: DateRange) {
    const start = formatDateInput(range.from);
    const end = formatDateInput(range.to);
    setCustomStart(start);
    setCustomEnd(end);
    if (start && end) handleApplyCustom(start, end);
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Visão geral</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{periodLabel}</span>
          {periodMode === "custom" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearCustom}
              className="h-6 px-2 text-xs text-muted-foreground"
            >
              <X className="mr-1 h-3 w-3" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-44 flex-col gap-1.5">
          <Label className={FILTER_LABEL_CLASS}>Período</Label>
          <Select value={periodMode === "preset" ? preset : ""} onValueChange={handleSelectPreset}>
            <SelectTrigger className="h-10 w-full bg-card">
              <SelectValue placeholder={periodMode === "custom" ? "Personalizado" : "Selecione"} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_PRESETS).map(([value, config]) => (
                <SelectItem key={value} value={value}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex w-64 flex-col gap-1.5">
          <Label className={FILTER_LABEL_CLASS}>Período personalizado</Label>
          <DateRangePicker
            value={customRange}
            onChange={handleCustomRangeChange}
            maxDate={new Date()}
            className="h-10 bg-card"
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          aria-label="Atualizar indicadores"
          className="h-10 w-10 bg-card"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </Button>
      </div>
    </div>
  );
}

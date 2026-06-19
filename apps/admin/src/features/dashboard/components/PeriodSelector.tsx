import React from "react";
import { CalendarRange } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { PeriodMode, PeriodPreset } from "../types";

type PeriodSelectorProps = {
  /** Selected period selection mode */
  periodMode: PeriodMode;
  /** Callback to change period selection mode */
  setPeriodMode: (mode: PeriodMode) => void;
  /** Selected preset value */
  period: PeriodPreset;
  /** Current start date input value for custom range */
  customStart: string;
  /** Callback to change start date value */
  setCustomStart: (val: string) => void;
  /** Current end date input value for custom range */
  customEnd: string;
  /** Callback to change end date value */
  setCustomEnd: (val: string) => void;
  /** Indicates if custom date popover is open */
  popoverOpen: boolean;
  /** Callback to toggle popover visibility */
  setPopoverOpen: (open: boolean) => void;
  /** Description label of the active period */
  periodLabel: string;
  /** Callback to submit and apply custom date range */
  handleApplyCustom: () => void;
  /** Callback to update period when preset is selected */
  handleSelectPreset: (value: string) => void;
};

/**
 * PeriodSelector
 * 
 * Renders selectors for predefined periods (7 days, 30 days, etc) or custom calendar ranges.
 */
export function PeriodSelector({
  periodMode,
  setPeriodMode,
  period,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  popoverOpen,
  setPopoverOpen,
  periodLabel,
  handleApplyCustom,
  handleSelectPreset,
}: PeriodSelectorProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-3xl font-display font-bold">Visão Geral</h1>
        <p className="mt-1 text-muted-foreground">Acompanhe os principais indicadores da sua empresa.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={periodMode === "preset" ? period : ""} onValueChange={handleSelectPreset}>
          <SelectTrigger className="h-10 w-44 bg-card">
            <SelectValue placeholder={periodMode === "custom" ? "Período personalizado" : "Selecione"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="90d">Últimos 90 dias</SelectItem>
            <SelectItem value="1y">Último ano</SelectItem>
          </SelectContent>
        </Select>

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant={periodMode === "custom" ? "default" : "outline"} size="sm" className="h-10 gap-2 text-sm">
              <CalendarRange className="h-4 w-4" />
              {periodMode === "custom" && customStart
                ? periodLabel
                : "Período personalizado"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 border-border bg-card p-4" align="end">
            <p className="mb-3 text-sm font-semibold">Selecionar período</p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Data inicial</Label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className="h-9 bg-background text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data final</Label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  max={new Date().toISOString().split("T")[0]}
                  className="h-9 bg-background text-sm"
                />
              </div>
              <Button
                className="h-9 w-full"
                onClick={handleApplyCustom}
                disabled={!customStart || !customEnd || customStart > customEnd}
              >
                Aplicar período
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

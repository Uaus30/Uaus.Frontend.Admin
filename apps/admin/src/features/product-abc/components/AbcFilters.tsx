import { RefreshCw, X } from "lucide-react";
import {
  Button,
  DateRangePicker,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
  formatDateInput,
  parseDateInput,
  type DateRange,
} from "@workspace/ui";
import type { AbcCriterion } from "@workspace/api-client-react";
import { PERIOD_PRESETS } from "@/features/dashboard/utils";
import type { PeriodMode, PeriodPreset } from "@/features/dashboard/types";
import { ABC_CRITERION_LABELS } from "../hooks/useProductAbc";

const FILTER_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

type AbcFiltersProps = {
  periodMode: PeriodMode;
  preset: PeriodPreset;
  customStart: string;
  setCustomStart: (value: string) => void;
  customEnd: string;
  setCustomEnd: (value: string) => void;
  onSelectPreset: (value: string) => void;
  onApplyCustom: (start?: string, end?: string) => void;
  onClearCustom: () => void;
  criterion: AbcCriterion;
  onCriterionChange: (value: AbcCriterion) => void;
  isFetching: boolean;
  onRefresh: () => void;
};

/**
 * Uma barra de filtros só, acima de tudo que ela recorta.
 *
 * Período e critério vão ao SERVIDOR: os dois reclassificam todo mundo, e
 * recortar depois deixaria a classe A da tela sendo a classe A de outro recorte.
 */
export function AbcFilters({
  periodMode,
  preset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  onSelectPreset,
  onApplyCustom,
  onClearCustom,
  criterion,
  onCriterionChange,
  isFetching,
  onRefresh,
}: AbcFiltersProps) {
  const customRange: DateRange = {
    from: parseDateInput(customStart),
    to: parseDateInput(customEnd),
  };

  function handleCustomRangeChange(range: DateRange) {
    const start = formatDateInput(range.from);
    const end = formatDateInput(range.to);
    setCustomStart(start);
    setCustomEnd(end);
    if (start && end) onApplyCustom(start, end);
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex w-44 flex-col gap-1.5">
        <Label className={FILTER_LABEL_CLASS}>Período</Label>
        <Select value={periodMode === "preset" ? preset : ""} onValueChange={onSelectPreset}>
          <SelectTrigger className="h-10 w-full bg-background">
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
          className="h-10 bg-background"
        />
      </div>

      {periodMode === "custom" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearCustom}
          className="h-10 text-xs text-muted-foreground"
        >
          <X className="mr-1 h-3 w-3" />
          Limpar
        </Button>
      )}

      <div className="flex w-52 flex-col gap-1.5">
        <Label className={FILTER_LABEL_CLASS}>Classificar por</Label>
        <Select
          value={String(criterion)}
          onValueChange={(value) => onCriterionChange(Number(value) as AbcCriterion)}
        >
          <SelectTrigger className="h-10 w-full bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ABC_CRITERION_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        aria-label="Atualizar a curva"
        className="ml-auto h-10 w-10 bg-background"
      >
        <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
      </Button>
    </div>
  );
}

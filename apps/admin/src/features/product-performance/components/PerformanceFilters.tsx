import { RefreshCw, Search, X } from "lucide-react";
import {
  Button,
  DateRangePicker,
  Input,
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
import { PERIOD_PRESETS } from "@/features/dashboard/utils";
import type { PeriodMode, PeriodPreset } from "@/features/dashboard/types";

const FILTER_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

type PerformanceFiltersProps = {
  periodMode: PeriodMode;
  preset: PeriodPreset;
  customStart: string;
  setCustomStart: (value: string) => void;
  customEnd: string;
  setCustomEnd: (value: string) => void;
  onSelectPreset: (value: string) => void;
  onApplyCustom: (start?: string, end?: string) => void;
  onClearCustom: () => void;
  search: string;
  onSearchChange: (value: string) => void;
  isFetching: boolean;
  onRefresh: () => void;
};

/**
 * Uma barra de filtros só, acima de tudo que ela recorta.
 *
 * O período vai ao servidor porque muda as réguas da loja e, com elas, a nota de
 * todo mundo. A busca é local e alcança os DOIS rankings — procurar um produto
 * aqui é querer saber em qual dos dois extremos ele caiu, e uma busca por tabela
 * obrigaria a digitar duas vezes para descobrir que ele não está em nenhuma.
 */
export function PerformanceFilters({
  periodMode,
  preset,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  onSelectPreset,
  onApplyCustom,
  onClearCustom,
  search,
  onSearchChange,
  isFetching,
  onRefresh,
}: PerformanceFiltersProps) {
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

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-xs">
        <Label className={FILTER_LABEL_CLASS}>Buscar nos dois rankings</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Produto, código, categoria ou fornecedor..."
            className="h-10 bg-background pl-9"
            aria-label="Buscar produto nos rankings"
          />
        </div>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        aria-label="Atualizar o desempenho"
        className="ml-auto h-10 w-10 bg-background"
      >
        <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
      </Button>
    </div>
  );
}

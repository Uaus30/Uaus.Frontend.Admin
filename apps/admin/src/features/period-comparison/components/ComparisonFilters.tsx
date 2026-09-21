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
import type { ComparisonDimension } from "@workspace/api-client-react";
import {
  COMPARISON_PRESET_LABELS,
  DIMENSION_LABELS,
  type ComparisonPreset,
  type ComparisonRange,
} from "../lib/comparison";

const FILTER_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

type ComparisonFiltersProps = {
  range: ComparisonRange;
  preset: ComparisonPreset;
  isCustom: boolean;
  onSelectPreset: (value: string) => void;
  onApplyCustom: (range: ComparisonRange, fixo: "previous" | "current") => void;
  onClearCustom: () => void;
  dimension: ComparisonDimension;
  onDimensionChange: (value: ComparisonDimension) => void;
  isFetching: boolean;
  onRefresh: () => void;
  /** Muda a cada limpeza ou troca de preset — ver `usePeriodComparison`. */
  resetToken: number;
};

/**
 * Os controles da comparação: os dois intervalos e o eixo da quebra.
 *
 * <b>Dois calendários, e não um.</b> A tela inteira é uma subtração, e um
 * seletor só obrigaria a escolher o "antes" em algum outro lugar — ou a aceitar
 * um período de referência que a tela decidiu sozinha. Os presets cobrem os
 * casos do dia a dia; os calendários existem para a pergunta que nenhum preset
 * antecipa ("como foi a semana do feriado contra a anterior").
 */
export function ComparisonFilters({
  range,
  preset,
  isCustom,
  onSelectPreset,
  onApplyCustom,
  onClearCustom,
  dimension,
  onDimensionChange,
  isFetching,
  onRefresh,
  resetToken,
}: ComparisonFiltersProps) {
  const previousRange: DateRange = {
    from: parseDateInput(range.previousStartDate),
    to: parseDateInput(range.previousEndDate),
  };

  const currentRange: DateRange = {
    from: parseDateInput(range.currentStartDate),
    to: parseDateInput(range.currentEndDate),
  };

  function aplicar(parcial: Partial<ComparisonRange>, fixo: "previous" | "current") {
    onApplyCustom({ ...range, ...parcial, label: "Períodos escolhidos no calendário" }, fixo);
  }

  /**
   * O que fazer com o que o calendário emitiu.
   *
   * O "X" do `DateRangePicker` manda `{from: undefined, to: undefined}`, e
   * ignorar isso — como o filtro da curva ABC ainda faz — deixava o gatilho
   * exibindo "Selecionar período" enquanto a consulta seguia no intervalo
   * antigo: o controle mentia até ser reaberto. Limpar aqui volta ao preset, que
   * é o estado que o rótulo passa a anunciar.
   */
  function aoEscolher(lado: "previous" | "current", valor: DateRange) {
    const inicio = formatDateInput(valor.from);
    const fim = formatDateInput(valor.to);

    if (!inicio && !fim) {
      onClearCustom();
      return;
    }

    // Uma ponta só é escolha pela metade: o calendário continua aberto e o
    // usuário ainda vai clicar na outra.
    if (!inicio || !fim) return;

    aplicar(
      lado === "previous"
        ? { previousStartDate: inicio, previousEndDate: fim }
        : { currentStartDate: inicio, currentEndDate: fim },
      lado,
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex w-56 flex-col gap-1.5">
        <Label className={FILTER_LABEL_CLASS}>Comparação</Label>
        <Select value={isCustom ? "" : preset} onValueChange={onSelectPreset}>
          <SelectTrigger className="h-10 w-full bg-background">
            <SelectValue placeholder={isCustom ? "Personalizada" : "Selecione"} />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COMPARISON_PRESET_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex w-60 flex-col gap-1.5">
        <Label className={FILTER_LABEL_CLASS}>Antes (referência)</Label>
        {/* A `key` força a remontagem quando o intervalo muda por fora — trocar
            o preset, limpar, ou a normalização acomodar este lado. O
            `DateRangePicker` guarda o intervalo em estado interno e só o
            reconcilia com `value` ao ABRIR, então sem isso o gatilho continua
            exibindo o intervalo antigo (ou "Selecionar período") ao lado de uma
            consulta que já usa outro. */}
        <DateRangePicker
          key={`antes-${resetToken}-${range.previousStartDate}-${range.previousEndDate}`}
          value={previousRange}
          onChange={(valor) => aoEscolher("previous", valor)}
          maxDate={new Date()}
          className="h-10 bg-background"
        />
      </div>

      <div className="flex w-60 flex-col gap-1.5">
        <Label className={FILTER_LABEL_CLASS}>Depois (em análise)</Label>
        <DateRangePicker
          key={`depois-${resetToken}-${range.currentStartDate}-${range.currentEndDate}`}
          value={currentRange}
          onChange={(valor) => aoEscolher("current", valor)}
          maxDate={new Date()}
          className="h-10 bg-background"
        />
      </div>

      {isCustom && (
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

      <div className="flex w-44 flex-col gap-1.5">
        <Label className={FILTER_LABEL_CLASS}>Quebrar por</Label>
        <Select
          value={String(dimension)}
          onValueChange={(valor) => onDimensionChange(Number(valor) as ComparisonDimension)}
        >
          <SelectTrigger className="h-10 w-full bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(DIMENSION_LABELS).map(([value, label]) => (
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
        aria-label="Atualizar a comparação"
        className="ml-auto h-10 w-10 bg-background"
      >
        <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
      </Button>
    </div>
  );
}

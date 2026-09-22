import { RefreshCw } from "lucide-react";
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
import { PROFIT_LEADERS_PERIOD, type ProfitLeadersPeriod } from "@workspace/api-client-react";
import type { CustomRange } from "../hooks/useProfitLeaders";
import { PERIOD_OPTIONS } from "../lib/profit-leaders";

const FILTER_LABEL_CLASS = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

type ProfitFiltersProps = {
  period: ProfitLeadersPeriod;
  custom: CustomRange | null;
  /** O que a resposta diz ter medido — é ele que o calendário exibe. */
  measured: { startDate: string; endDate: string } | null;
  onSelectPeriod: (value: ProfitLeadersPeriod) => void;
  onApplyCustom: (range: CustomRange) => void;
  onClearCustom: () => void;
  isFetching: boolean;
  onRefresh: () => void;
  /** Muda a cada limpeza ou troca de preset — ver `useProfitLeaders`. */
  resetToken: number;
};

/**
 * O seletor de período.
 *
 * <b>O preset vai como número para o servidor, e não como duas datas.</b> "Desde
 * a inauguração" só o banco sabe resolver — a primeira venda da loja não está na
 * tela —, e deixar o cálculo dos outros presets do mesmo lado evita que o front
 * monte data de calendário com `toISOString()`, que joga o dia para trás no
 * Brasil (armadilha 2 do repositório).
 *
 * O calendário exibe o intervalo que a RESPOSTA diz ter medido, e não o que a
 * tela pediu: assim o rótulo nunca anuncia um período diferente do que está
 * desenhado abaixo dele.
 */
export function ProfitFilters({
  period,
  custom,
  measured,
  onSelectPeriod,
  onApplyCustom,
  onClearCustom,
  isFetching,
  onRefresh,
  resetToken,
}: ProfitFiltersProps) {
  const emModoCustom = period === PROFIT_LEADERS_PERIOD.Custom;

  const intervalo: DateRange = {
    from: parseDateInput(custom?.startDate ?? measured?.startDate),
    to: parseDateInput(custom?.endDate ?? measured?.endDate),
  };

  /**
   * O "X" do `DateRangePicker` manda `{from: undefined, to: undefined}`. Ignorar
   * isso deixaria o gatilho exibindo "Selecionar período" enquanto a consulta
   * segue no intervalo antigo — o controle mentindo até ser reaberto.
   */
  function aoEscolher(valor: DateRange) {
    const startDate = formatDateInput(valor.from);
    const endDate = formatDateInput(valor.to);

    if (!startDate && !endDate) {
      onClearCustom();
      return;
    }

    // Uma ponta só é escolha pela metade: o calendário continua aberto e o
    // usuário ainda vai clicar na outra.
    if (!startDate || !endDate) return;

    onApplyCustom({ startDate, endDate });
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border/60 bg-card p-4">
      <div className="flex w-56 flex-col gap-1.5">
        <Label className={FILTER_LABEL_CLASS}>Período</Label>
        <Select
          value={String(period)}
          onValueChange={(valor) => onSelectPeriod(Number(valor) as ProfitLeadersPeriod)}
        >
          <SelectTrigger className="h-10 w-full bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opcao) => (
              <SelectItem key={opcao.value} value={String(opcao.value)}>
                {opcao.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {emModoCustom && (
        <div className="flex w-64 flex-col gap-1.5">
          <Label className={FILTER_LABEL_CLASS}>Intervalo</Label>
          {/* A `key` força a remontagem quando o intervalo muda por fora. O
              `DateRangePicker` guarda o intervalo em estado interno e só o
              reconcilia com `value` ao ABRIR — sem isso o gatilho continua
              exibindo o intervalo antigo ao lado de uma consulta que já usa
              outro. */}
          <DateRangePicker
            key={`intervalo-${resetToken}-${intervalo.from?.getTime()}-${intervalo.to?.getTime()}`}
            value={intervalo}
            onChange={aoEscolher}
            maxDate={new Date()}
            className="h-10 bg-background"
          />
        </div>
      )}

      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        aria-label="Atualizar o ranking"
        className="ml-auto h-10 w-10 bg-background"
      >
        <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
      </Button>
    </div>
  );
}

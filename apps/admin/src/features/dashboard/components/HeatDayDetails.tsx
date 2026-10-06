import { formatCurrency } from "@workspace/core";
import type { HeatCell, HeatWeek } from "../heatmap";
import { formatSignedPercent, growth } from "../utils";
import { WEEKDAY_PLURAL, dayTitle } from "../heat-labels";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-6 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

/**
 * O detalhe de um dia do calendário de calor: faturamento, lucro, vendas,
 * ticket e a comparação com a média do mesmo dia da semana.
 *
 * Um componente só para os DOIS lugares onde ele aparece (06/10/2026): a dica do
 * hover, no computador, e o painel que abre ao tocar no dia, no celular — onde a
 * dica do Radix não abre e o calendário virava só cor.
 */
export function HeatDayDetails({ cell }: { cell: HeatCell }) {
  const vsWeekday = growth(cell.revenue, cell.weekdayAverage);

  return (
    <div className="space-y-1">
      <p className="mb-1.5 text-xs font-semibold text-foreground">
        {dayTitle(cell)}
        {cell.isToday && <span className="font-normal text-muted-foreground"> · em andamento</span>}
      </p>
      {cell.salesCount === 0 ? (
        <p className="text-xs text-muted-foreground">Sem venda neste dia.</p>
      ) : (
        <>
          <DetailRow label="Faturamento" value={formatCurrency(cell.revenue)} />
          <DetailRow label="Lucro" value={formatCurrency(cell.profit)} />
          <DetailRow label="Vendas" value={String(cell.salesCount)} />
          <DetailRow label="Ticket médio" value={formatCurrency(cell.revenue / cell.salesCount)} />
          {cell.weekdayAverage > 0 && vsWeekday !== null && !cell.isToday && (
            <p className="pt-1 text-[11px] text-muted-foreground">
              {formatSignedPercent(vsWeekday)} contra a média das {WEEKDAY_PLURAL[cell.dayOfWeek]} (
              {formatCurrency(cell.weekdayAverage)})
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * O total da semana do dia escolhido — no celular a coluna "Semana" sai do
 * calendário (sete colunas de ~40px já são o que cabe) e o total vem no painel.
 */
export function HeatWeekLine({ week }: { week: HeatWeek }) {
  return (
    <p className="border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
      Semana: <span className="font-medium text-foreground">{formatCurrency(week.total)}</span>
      {week.growth !== null && (
        <span className={week.growth >= 0 ? "text-emerald-400" : "text-destructive"}>
          {" "}
          ({formatSignedPercent(week.growth)} contra a anterior)
        </span>
      )}
    </p>
  );
}

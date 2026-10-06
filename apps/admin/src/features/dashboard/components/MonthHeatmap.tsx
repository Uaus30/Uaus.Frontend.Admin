import React, { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Skeleton, Tooltip, TooltipContent, TooltipTrigger, cn, formatDateInput } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { DashboardMonthly } from "../types";
import {
  NORMAL_DAY_POSITION,
  buildHeatGrid,
  indexDays,
  resolveReferenceRevenue,
  type HeatCell,
  type HeatWeek,
} from "../heatmap";
import { formatSignedPercent, monthLabel } from "../utils";
import { CHART_TOOLTIP_CLASS, ChartCard, ChartEmptyState } from "./chart-primitives";
import { HeatDayDetails, HeatWeekLine } from "./HeatDayDetails";
import { dayTitle } from "../heat-labels";
import { useNarrowerThan } from "@/hooks/use-narrower-than";

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

/** "julho" a partir de uma data da API (`2026-07-01T00:00:00`). */
function monthName(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return monthLabel(new Date(year, month - 1, 1))
    .split("/")[0]
    .toLowerCase();
}

/** Valor curto que cabe na célula: "R$ 445", "R$ 1,2 mil". */
function cellMoney(value: number): string {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1).replace(".", ",")} mil`;
  return `R$ ${Math.round(value)}`;
}

/**
 * Onde a tinta do número passa de escura para branca: entre `--heat-3` e
 * `--heat-4`, onde as duas empatam em contraste (ver `index.css`).
 */
const INK_SWITCH_POSITION = 3.5;

/**
 * Fundo e tinta de uma posição da escala (ver `--heat-*` no `index.css`).
 *
 * A cor entre dois pontos sai do `color-mix` em OKLab, que interpola pela
 * luminosidade percebida — em RGB o meio do caminho entre dois verdes escurece.
 */
function heatStyle(position: number | null): React.CSSProperties | undefined {
  if (position === null) return undefined;

  const index = Math.min(Math.floor(position), 4);
  const fraction = Math.round((position - index) * 100);
  const backgroundColor =
    fraction <= 0
      ? `var(--heat-${index})`
      : `color-mix(in oklab, var(--heat-${index + 1}) ${fraction}%, var(--heat-${index}))`;

  return {
    backgroundColor,
    color: position < INK_SWITCH_POSITION ? "var(--heat-ink-dark)" : "var(--heat-ink-light)",
  };
}

/** Abaixo de `sm` o calendário perde a coluna "Semana" e o valor escrito na célula. */
const COMPACT_BELOW = 640;

function DayCell({
  cell,
  selected,
  onSelect,
}: {
  cell: HeatCell;
  selected: boolean;
  onSelect: (date: string) => void;
}) {
  const title = dayTitle(cell);

  if (!cell.hasHappened) {
    return (
      <div
        className="flex h-14 items-start rounded-md border border-dashed border-border/50 p-1.5"
        aria-label={`${title}: ainda não aconteceu`}
      >
        <span className="text-[10px] leading-none text-muted-foreground/60">{cell.day}</span>
      </div>
    );
  }

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        {/* Botão, e não só imagem: no celular a dica do Radix não abre, e tocar
            no dia é o que mostra o detalhe dele, no painel embaixo do
            calendário (06/10/2026). */}
        <button
          type="button"
          aria-label={`${title}: ${formatCurrency(cell.revenue)}`}
          aria-pressed={selected}
          onClick={() => onSelect(cell.date)}
          style={heatStyle(cell.position)}
          className={cn(
            "relative flex h-14 cursor-pointer flex-col justify-between rounded-md p-1.5 text-left transition-transform hover:scale-[1.04]",
            cell.position === null && "bg-muted/40 text-muted-foreground",
            "ring-1 ring-inset ring-black/10",
            cell.isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card",
            // O anel de "hoje" (o da legenda) prevalece: no celular hoje já abre
            // escolhido, e trocar a cor dele confundiria a leitura.
            selected && !cell.isToday && "ring-2 ring-foreground",
          )}
        >
          <div className="flex items-start justify-between">
            <span className="text-[10px] leading-none opacity-80">{cell.day}</span>
            {cell.signal && (
              <span className="text-[10px] font-bold leading-none" aria-hidden>
                {cell.signal === "above" ? "▲" : "▼"}
              </span>
            )}
          </div>
          {/* Do `sm` para cima: numa célula de ~40px o valor virava "R…". */}
          <span className="hidden truncate text-xs font-semibold tabular-nums leading-none sm:block">
            {cell.revenue > 0 ? cellMoney(cell.revenue) : "—"}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className={cn(CHART_TOOLTIP_CLASS, "min-w-[200px] p-3")}>
        <HeatDayDetails cell={cell} />
      </TooltipContent>
    </Tooltip>
  );
}

function WeekTotal({ week, isCurrent }: { week: HeatWeek; isCurrent: boolean }) {
  const lived = week.cells.some((cell) => cell?.hasHappened);
  if (!lived) return <div className="h-14" />;

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <div className="flex h-14 cursor-default flex-col items-end justify-center gap-1 rounded-md bg-muted/30 px-2">
          <span className="text-xs font-semibold tabular-nums text-foreground">{cellMoney(week.total)}</span>
          {week.growth !== null && (
            <span
              className={cn(
                "text-[10px] font-medium tabular-nums",
                week.growth >= 0 ? "text-emerald-400" : "text-destructive",
              )}
            >
              {formatSignedPercent(week.growth)}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className={cn(CHART_TOOLTIP_CLASS, "max-w-[240px] p-3 text-xs")}>
        <p className="font-semibold text-foreground">Semana: {formatCurrency(week.total)}</p>
        <p className="mt-1 text-muted-foreground">
          {week.previousTotal === null
            ? isCurrent
              ? "A comparação começa amanhã: hoje só entra depois de fechado."
              : "Sem a semana anterior nos dados para comparar."
            : isCurrent
              ? `Até ontem: ${formatCurrency(week.comparableTotal)}, contra ${formatCurrency(week.previousTotal)} nos mesmos dias da semana anterior. Hoje fica fora da comparação até fechar.`
              : `Contra ${formatCurrency(week.previousTotal)} nos mesmos dias da semana anterior.`}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

const LEGEND_GRADIENT = `linear-gradient(to right, ${[0, 1, 2, 3, 4, 5].map((step) => `var(--heat-${step})`).join(", ")})`;

function Legend({ referenceRevenue }: { referenceRevenue: number }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Fraco</span>
        <div className="relative">
          <span className="block h-3 w-40 rounded-[3px]" style={{ background: LEGEND_GRADIENT }} />
          {/* Marca onde fica o dia normal: o meio da escala. */}
          <span
            className="absolute -top-1 h-5 w-px bg-foreground/70"
            style={{ left: `${(NORMAL_DAY_POSITION / 5) * 100}%` }}
            title={referenceRevenue > 0 ? `Dia normal: ${formatCurrency(referenceRevenue)}` : "Dia normal"}
          />
        </div>
        <span>Forte (2x o normal)</span>
      </div>
      <span>▲▼ fora do normal para o dia da semana</span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-[3px] ring-2 ring-primary ring-offset-1 ring-offset-card" /> hoje
      </span>
    </div>
  );
}

type MonthHeatmapProps = {
  monthly?: DashboardMonthly;
  isLoading: boolean;
};

/**
 * MonthHeatmap
 *
 * Faturamento de cada dia do mês num calendário de segunda a sábado, com a cor
 * pela régua de um dia "normal" e o total de cada semana na última coluna.
 *
 * É calendário, e não a faixa de 365 dias estilo GitHub, porque o mês tem pouco
 * mais de trinta dias: cabe o valor escrito em cada célula, e a leitura em linha
 * (semana contra semana) e em coluna (sábado contra sábado) sai de graça. A coluna
 * de semana substitui o antigo card "semana atual x anterior". As regras de cor,
 * seta e comparação estão em `heatmap.ts`.
 */
export function MonthHeatmap({ monthly, isLoading }: MonthHeatmapProps) {
  const [showPrevious, setShowPrevious] = useState(false);
  const compact = useNarrowerThan(COMPACT_BELOW);
  // O dia tocado. Sem escolha, no celular o painel abre no dia de hoje — senão o
  // calendário compacto (sem o valor nas células) não mostraria número nenhum.
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const view = useMemo(() => {
    if (!monthly) return null;
    const month = showPrevious ? monthly.previousMonth : monthly.currentMonth;
    const months = [monthly.previousMonth, monthly.currentMonth];
    // A régua é a mesma nos dois meses, para as cores serem comparáveis.
    const referenceRevenue = resolveReferenceRevenue(monthly.reference, months);
    const grid = buildHeatGrid(
      month,
      indexDays(months),
      monthly.reference,
      referenceRevenue,
      formatDateInput(new Date()),
    );
    return { month, grid, referenceRevenue };
  }, [monthly, showPrevious]);

  if (isLoading || !monthly || !view) {
    return <Skeleton className="h-[440px] rounded-xl" />;
  }

  const { month, grid, referenceRevenue } = view;
  const reference = monthly.reference;
  const hasHistory = reference && reference.averageRevenue > 0;
  const description = hasHistory
    ? `Cor pela régua de um dia normal: ${formatCurrency(referenceRevenue)}, a média dos dias com venda de ${monthName(reference.startDate)} a ${monthName(reference.endDate)}`
    : "Cor pela média dos dias com venda exibidos";

  const switcher = (
    <div className="flex rounded-lg border border-border/60 bg-muted/20 p-0.5 text-xs">
      {[monthly.previousMonth, monthly.currentMonth].map((item, index) => {
        const active = showPrevious === (index === 0);
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              setShowPrevious(index === 0);
              setSelectedDate(null);
            }}
            className={cn(
              "rounded-md px-2.5 py-1 transition-colors",
              active
                ? "bg-primary font-medium text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label.split("/")[0]}
          </button>
        );
      })}
    </div>
  );

  const hasSales = month.days.some((day) => day.hasHappened && day.salesCount > 0);
  const template = compact
    ? `repeat(${grid.columns.length}, minmax(0, 1fr))`
    : `repeat(${grid.columns.length}, minmax(0, 1fr)) minmax(68px, 0.9fr)`;

  const todayDate = grid.weeks.flatMap((week) => week.cells).find((cell) => cell?.isToday)?.date ?? null;
  const shownDate = selectedDate ?? (compact ? todayDate : null);
  const shownWeek = shownDate
    ? grid.weeks.find((week) => week.cells.some((cell) => cell?.date === shownDate))
    : undefined;
  const shownCell = shownWeek?.cells.find((cell) => cell?.date === shownDate) ?? null;
  const toggleDay = (date: string) => setSelectedDate((current) => (current === date ? null : date));

  return (
    <ChartCard title={`Faturamento por dia · ${month.label}`} description={description} action={switcher}>
      {!hasSales && month.daysElapsed > 0 && !month.isCurrentMonth ? (
        <ChartEmptyState message="Nenhuma venda neste mês." />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: template }}>
            {grid.columns.map((dayOfWeek) => (
              <span
                key={dayOfWeek}
                className="pb-0.5 text-center text-[11px] font-medium text-muted-foreground"
              >
                {WEEKDAY_SHORT[dayOfWeek]}
              </span>
            ))}
            {!compact && (
              <span className="pb-0.5 text-right text-[11px] font-medium text-muted-foreground">Semana</span>
            )}

            {grid.weeks.map((week, weekIndex) => {
              const isCurrent = week.cells.some((cell) => cell?.isToday);
              return (
                <React.Fragment key={weekIndex}>
                  {week.cells.map((cell, column) =>
                    cell ? (
                      <DayCell
                        key={cell.date}
                        cell={cell}
                        selected={cell.date === selectedDate}
                        onSelect={toggleDay}
                      />
                    ) : (
                      <div key={`empty-${column}`} className="h-14" />
                    ),
                  )}
                  {!compact && <WeekTotal week={week} isCurrent={isCurrent} />}
                </React.Fragment>
              );
            })}
          </div>
          {shownCell && shownWeek ? (
            <div
              className="relative rounded-lg border border-border/60 bg-muted/20 p-3"
              data-testid="heat-day-panel"
            >
              {selectedDate !== null && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(null)}
                  aria-label="Fechar o detalhe do dia"
                  className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <HeatDayDetails cell={shownCell} />
              {compact && <HeatWeekLine week={shownWeek} />}
            </div>
          ) : (
            compact && (
              <p className="text-xs text-muted-foreground">
                Toque num dia para ver o faturamento, o lucro e as vendas dele.
              </p>
            )
          )}
          <Legend referenceRevenue={referenceRevenue} />
        </div>
      )}
    </ChartCard>
  );
}

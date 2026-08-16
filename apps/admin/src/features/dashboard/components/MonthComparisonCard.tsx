import React, { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@workspace/ui";
import { cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { DashboardMonthly } from "../types";
import { compactCurrency, formatSignedPercent } from "../utils";
import {
  AXIS_PROPS,
  ChartCard,
  ChartEmptyState,
  ChartTooltip,
  GRID_PROPS,
  SERIES_COLORS,
  SURFACE_COLOR,
  SeriesLegend,
} from "./chart-primitives";

type MonthComparisonCardProps = {
  monthly?: DashboardMonthly;
  comparison: {
    sameDayGrowth: number | null;
    fullMonthGrowth: number | null;
    projectedGrowth: number | null;
    profitSameDayGrowth: number | null;
  } | null;
  isLoading: boolean;
};

/** Número com rótulo e variação, usado no resumo acima do gráfico. */
function Figure({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: number | null;
  hint?: string;
}) {
  const isGood = (delta ?? 0) >= 0;

  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{value}</p>
      {delta !== undefined && (
        <p
          className={cn(
            "mt-0.5 text-xs font-medium tabular-nums",
            delta === null ? "text-muted-foreground" : isGood ? "text-emerald-400" : "text-destructive",
          )}
        >
          {delta === null ? "sem base" : formatSignedPercent(delta)}
        </p>
      )}
      {hint && <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * MonthComparisonCard
 *
 * Mês corrente contra o anterior, pela curva acumulada dia a dia.
 *
 * O acumulado é o que permite a leitura honesta: as duas linhas partem do mesmo
 * zero e a distância entre elas no dia de hoje é exatamente a diferença entre os
 * dois meses até aqui. Comparar os totais brutos faria o mês corrente parecer
 * pior todo dia que não fosse o último.
 *
 * A linha do mês corrente para no dia de hoje — o backend marca os dias futuros
 * com `hasHappened: false` para que ela não despenque até zero no fim do mês.
 */
export function MonthComparisonCard({ monthly, comparison, isLoading }: MonthComparisonCardProps) {
  const chartData = useMemo(() => {
    if (!monthly) return [];

    const previousByDay = new Map(monthly.previousMonth.days.map((day) => [day.day, day]));
    const currentByDay = new Map(monthly.currentMonth.days.map((day) => [day.day, day]));
    const totalDays = Math.max(monthly.currentMonth.daysInMonth, monthly.previousMonth.daysInMonth);

    return Array.from({ length: totalDays }, (_, index) => {
      const day = index + 1;
      const current = currentByDay.get(day);
      return {
        day,
        current: current?.hasHappened ? current.accumulatedRevenue : null,
        previous: previousByDay.get(day)?.accumulatedRevenue ?? null,
      };
    });
  }, [monthly]);

  if (isLoading || !monthly || !comparison) {
    return <Skeleton className="h-[420px] rounded-xl" />;
  }

  const legend = [
    { name: monthly.currentMonth.label, color: SERIES_COLORS[0] },
    { name: monthly.previousMonth.label, color: SERIES_COLORS[1] },
  ];

  const hasData = monthly.currentMonth.revenue > 0 || monthly.previousMonth.revenue > 0;

  return (
    <ChartCard
      title="Mês atual x mês anterior"
      description="Faturamento acumulado dia a dia"
      action={<SeriesLegend items={legend} />}
    >
      <div className="grid grid-cols-2 gap-4 rounded-lg border border-border/60 bg-muted/20 p-4 sm:grid-cols-4">
        <Figure
          label={monthly.currentMonth.label}
          value={formatCurrency(monthly.currentMonth.revenue)}
          hint={`${monthly.currentMonth.daysElapsed} de ${monthly.currentMonth.daysInMonth} dias`}
        />
        <Figure
          label="Mesmo dia do mês anterior"
          value={formatCurrency(monthly.previousMonthSameDayRevenue)}
          delta={comparison.sameDayGrowth}
        />
        <Figure
          label={`${monthly.previousMonth.label} fechado`}
          value={formatCurrency(monthly.previousMonth.revenue)}
          delta={comparison.fullMonthGrowth}
        />
        <Figure
          label="Projeção do mês"
          value={formatCurrency(monthly.projectedRevenue)}
          delta={comparison.projectedGrowth}
          hint="No ritmo atual"
        />
      </div>

      {hasData ? (
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis
                dataKey="day"
                {...AXIS_PROPS}
                tickFormatter={(day: number) => `${day}`}
                minTickGap={16}
              />
              <YAxis {...AXIS_PROPS} tickFormatter={compactCurrency} width={56} />
              <Tooltip
                cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                content={<ChartTooltip labelFormatter={(day) => `Dia ${day}`} />}
              />
              <Line
                type="monotone"
                dataKey="current"
                name={monthly.currentMonth.label}
                stroke={SERIES_COLORS[0]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: SURFACE_COLOR }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="previous"
                name={monthly.previousMonth.label}
                stroke={SERIES_COLORS[1]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: SURFACE_COLOR }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmptyState message="Ainda não há vendas nos dois meses comparados." />
      )}
    </ChartCard>
  );
}

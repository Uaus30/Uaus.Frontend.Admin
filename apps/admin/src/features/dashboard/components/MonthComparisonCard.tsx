import React, { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { DashboardMonthly } from "../types";
import { compactCurrency } from "../utils";
import {
  AXIS_PROPS,
  ChartCard,
  ChartEmptyState,
  ChartTooltip,
  GRID_PROPS,
  MUTED_COLOR,
  SERIES_COLORS,
  SURFACE_COLOR,
  SeriesLegend,
} from "./chart-primitives";

type MonthComparisonCardProps = {
  monthly?: DashboardMonthly;
  isLoading: boolean;
};

/** Id do gradiente; único na página, porque o SVG resolve `url(#id)` no documento todo. */
const GRADIENT_ID = "month-comparison-current-fill";

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
 * O mês corrente é a série em destaque (área com cor); o anterior é contexto,
 * em cinza tracejado. O card não escreve percentual de propósito: os cards do
 * topo já comparam o mês pelos mesmos dias da semana, e um segundo número aqui,
 * pelo dia do mês, contradiria aquele no começo de todo mês.
 *
 * A linha do mês corrente para no dia de hoje — o backend marca os dias futuros
 * com `hasHappened: false` para que ela não despenque até zero no fim do mês.
 */
export function MonthComparisonCard({ monthly, isLoading }: MonthComparisonCardProps) {
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

  if (isLoading || !monthly) {
    return <Skeleton className="h-[440px] rounded-xl" />;
  }

  const legend = [
    { name: monthly.currentMonth.label, color: SERIES_COLORS[0] },
    { name: monthly.previousMonth.label, color: MUTED_COLOR },
  ];

  const hasData = monthly.currentMonth.revenue > 0 || monthly.previousMonth.revenue > 0;
  const lastPoint = [...chartData].reverse().find((point) => point.current !== null);

  return (
    <ChartCard
      title="Ritmo do mês"
      description="Faturamento acumulado dia a dia, contra o mês anterior"
      action={<SeriesLegend items={legend} />}
    >
      {hasData ? (
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 24, right: 16, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity={0} />
                </linearGradient>
              </defs>
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
                dataKey="previous"
                name={monthly.previousMonth.label}
                stroke={MUTED_COLOR}
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: SURFACE_COLOR }}
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="current"
                name={monthly.currentMonth.label}
                stroke={SERIES_COLORS[0]}
                strokeWidth={2.5}
                fill={`url(#${GRADIENT_ID})`}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: SURFACE_COLOR }}
                connectNulls={false}
              />
              {lastPoint && lastPoint.current !== null && (
                <ReferenceDot
                  x={lastPoint.day}
                  y={lastPoint.current}
                  r={5}
                  fill={SERIES_COLORS[0]}
                  stroke={SURFACE_COLOR}
                  strokeWidth={2}
                  label={{
                    value: formatCurrency(lastPoint.current),
                    position: "top",
                    fill: "hsl(var(--foreground))",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmptyState message="Ainda não há vendas nos dois meses comparados." />
      )}
    </ChartCard>
  );
}

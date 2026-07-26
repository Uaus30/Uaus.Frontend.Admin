import React from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardSeriesPoint } from "../types";
import { compactCurrency, formatAxisDate, formatBrazilianDate } from "../utils";
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

type RevenueProfitChartProps = {
  series: DashboardSeriesPoint[];
  periodLabel: string;
  isLoading: boolean;
};

const LEGEND = [
  { name: "Faturamento", color: SERIES_COLORS[0] },
  { name: "Lucro", color: SERIES_COLORS[1] },
];

/**
 * RevenueProfitChart
 *
 * Faturamento e lucro dia a dia no período selecionado.
 *
 * As duas séries dividem o mesmo eixo de propósito. Dar ao lucro uma escala
 * própria faria as curvas parecerem coladas e esconderia justamente o que o
 * gráfico existe para mostrar: o tamanho da distância entre o que entra e o que
 * sobra.
 */
export function RevenueProfitChart({ series, periodLabel, isLoading }: RevenueProfitChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[420px] rounded-xl" />;
  }

  const hasData = series.some((point) => point.revenue !== 0 || point.profit !== 0);

  return (
    <ChartCard
      title="Faturamento e lucro"
      description={periodLabel}
      action={<SeriesLegend items={LEGEND} />}
    >
      {hasData ? (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="dashboardRevenueFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="dashboardProfitFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_COLORS[1]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={SERIES_COLORS[1]} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="date" {...AXIS_PROPS} tickFormatter={formatAxisDate} minTickGap={24} />
              <YAxis {...AXIS_PROPS} tickFormatter={compactCurrency} width={56} />
              <Tooltip
                cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                content={<ChartTooltip labelFormatter={formatBrazilianDate} />}
              />

              <Area
                type="monotone"
                dataKey="revenue"
                name="Faturamento"
                stroke={SERIES_COLORS[0]}
                strokeWidth={2}
                fill="url(#dashboardRevenueFill)"
                // O anel na cor da superfície mantém o ponto legível onde as duas
                // curvas se cruzam.
                activeDot={{ r: 5, strokeWidth: 2, stroke: SURFACE_COLOR }}
              />
              <Area
                type="monotone"
                dataKey="profit"
                name="Lucro"
                stroke={SERIES_COLORS[1]}
                strokeWidth={2}
                fill="url(#dashboardProfitFill)"
                activeDot={{ r: 5, strokeWidth: 2, stroke: SURFACE_COLOR }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmptyState message="Nenhuma venda registrada no período selecionado." />
      )}
    </ChartCard>
  );
}

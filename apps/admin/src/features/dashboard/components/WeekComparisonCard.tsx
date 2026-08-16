import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@workspace/ui";
import { cn } from "@workspace/ui";
import { accumulateWeekComparison, formatCurrency } from "@workspace/core";
import type { PerformanceRangeDto, WeekdayComparisonDto } from "@workspace/api-client-react";
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

/** Rótulos na ordem da semana comercial — segunda primeiro. */
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

export type WeekComparisonCardProps = {
  days: WeekdayComparisonDto[];
  week: PerformanceRangeDto | null;
  isLoading: boolean;
};

/**
 * Semana atual contra a anterior, pela curva acumulada dia a dia.
 *
 * A semana começa na SEGUNDA, decidida no servidor: é como o varejo conta, e
 * mantém o fim de semana junto no fim do intervalo em vez de partido entre duas
 * semanas.
 *
 * O formato é o MESMO do card de meses, de propósito: duas linhas acumuladas
 * partindo do mesmo zero, com a distância entre elas em qualquer dia mostrando
 * exatamente quanto uma semana está na frente da outra. A conta vem de
 * `accumulateWeekComparison` no `@workspace/core` — o PDV desenha a mesma curva
 * a partir da mesma função, então painel e caixa nunca divergem no acumulado.
 *
 * A linha da semana atual para no dia de hoje: o dia futuro entra como `null` e
 * o recharts corta a linha ali, em vez de despencar até zero no domingo.
 */
export function WeekComparisonCard({ days, week, isLoading }: WeekComparisonCardProps) {
  const data = useMemo(
    () =>
      accumulateWeekComparison(days).map((point) => ({
        label: WEEKDAY_LABELS[point.weekday] ?? "?",
        current: point.current,
        previous: point.previous,
      })),
    [days],
  );

  const semVenda = days.every((day) => (day.isFuture ? 0 : day.revenue) === 0 && day.previousRevenue === 0);

  const legend = [
    { name: "Semana atual", color: SERIES_COLORS[0] },
    { name: "Semana anterior", color: SERIES_COLORS[1] },
  ];

  return (
    <ChartCard
      title="Semana atual x semana anterior"
      description="Faturamento acumulado de segunda a domingo. A linha da semana atual para em hoje."
      action={<SeriesLegend items={legend} />}
    >
      {isLoading ? (
        <Skeleton className="h-[260px] w-full" />
      ) : semVenda ? (
        <ChartEmptyState message="Nenhuma venda registrada nas duas últimas semanas." />
      ) : (
        <div className="space-y-4">
          {week && (
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Acumulado da semana
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                  {formatCurrency(week.revenue)}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Mesma altura da semana passada
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-muted-foreground">
                  {formatCurrency(week.previousRevenue)}
                </p>
              </div>
              <p
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  week.changePercentage == null
                    ? "text-muted-foreground"
                    : week.changePercentage >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive",
                )}
              >
                {/* O recorte "mesma altura" é do servidor: comparar a terça em
                    curso com a semana passada inteira mostraria uma queda que é
                    só o calendário. */}
                {week.changePercentage == null
                  ? "sem base de comparação"
                  : formatSignedPercent(week.changePercentage)}
              </p>
            </div>
          )}

          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={compactCurrency} width={56} />
              <Tooltip
                cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                content={<ChartTooltip valueFormatter={formatCurrency} />}
              />
              <Line
                type="monotone"
                dataKey="current"
                name="Semana atual"
                stroke={SERIES_COLORS[0]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: SURFACE_COLOR }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="previous"
                name="Semana anterior"
                stroke={SERIES_COLORS[1]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: SURFACE_COLOR }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

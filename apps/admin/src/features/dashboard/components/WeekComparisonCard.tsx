import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@workspace/ui";
import { cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { PerformanceRangeDto, WeekdayComparisonDto } from "@workspace/api-client-react";
import { compactCurrency, formatSignedPercent } from "../utils";
import {
  AXIS_PROPS,
  ChartCard,
  ChartEmptyState,
  ChartTooltip,
  GRID_PROPS,
  MAX_BAR_SIZE,
  SERIES_COLORS,
} from "./chart-primitives";

/** Rótulos na ordem da semana comercial — segunda primeiro. */
const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"] as const;

export type WeekComparisonCardProps = {
  days: WeekdayComparisonDto[];
  week: PerformanceRangeDto | null;
  isLoading: boolean;
};

/**
 * Semana atual contra a anterior, dia a dia.
 *
 * A semana começa na SEGUNDA, decidida no servidor: é como o varejo conta, e
 * mantém o fim de semana junto no fim do intervalo em vez de partido entre duas
 * semanas.
 *
 * Barras e não linhas, ao contrário do card de meses: aqui são sete pontos
 * discretos e a pergunta é "qual dia foi fraco?", não "qual a tendência".
 */
export function WeekComparisonCard({ days, week, isLoading }: WeekComparisonCardProps) {
  const data = useMemo(
    () =>
      days.map((day) => ({
        label: WEEKDAY_LABELS[day.weekday] ?? "?",
        // O dia que ainda não chegou entra como null, não como zero: o recharts
        // omite o null e desenha a lacuna, enquanto o zero viraria uma queda.
        atual: day.isFuture ? null : day.revenue,
        anterior: day.previousRevenue,
        isFuture: day.isFuture,
      })),
    [days],
  );

  const semVenda = data.every((d) => (d.atual ?? 0) === 0 && d.anterior === 0);

  return (
    <ChartCard
      title="Semana atual x semana anterior"
      description="De segunda a domingo. Dias que ainda não chegaram ficam sem barra."
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
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="label" {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} tickFormatter={compactCurrency} width={64} />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted) / 0.35)" }}
                content={<ChartTooltip valueFormatter={formatCurrency} />}
              />
              <Bar
                dataKey="anterior"
                name="Semana anterior"
                fill={SERIES_COLORS[1]}
                maxBarSize={MAX_BAR_SIZE}
                radius={[3, 3, 0, 0]}
              />
              <Bar
                dataKey="atual"
                name="Semana atual"
                fill={SERIES_COLORS[0]}
                maxBarSize={MAX_BAR_SIZE}
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

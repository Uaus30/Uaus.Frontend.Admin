import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { LoyaltyChartsDto } from "@workspace/api-client-react";
import { Skeleton } from "@workspace/ui";
import {
  AXIS_PROPS,
  ChartCard,
  ChartEmptyState,
  ChartTooltip,
  GRID_PROPS,
  MAX_BAR_SIZE,
  SERIES_COLORS,
  SeriesLegend,
} from "@/features/dashboard/components/chart-primitives";
import { LoyaltyProfileCharts } from "./LoyaltyProfileCharts";

const count = (value: number) => value.toLocaleString("pt-BR");
const weekLabel = (iso: string) => {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
};

/**
 * Os gráficos do painel (entrega 5, 01/10/2026). Carimbos por semana mostra se
 * o programa pegou; os cartões abertos mostram quem está perto do prêmio — em
 * destaque, os que estão a 1 carimbo, que são a próxima volta do cliente.
 */
export function LoyaltyCharts({ charts, isLoading }: { charts?: LoyaltyChartsDto; isLoading: boolean }) {
  if (isLoading || !charts) {
    return (
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-[360px] rounded-xl" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
    );
  }

  const hasStamps = charts.stampsByWeek.some((week) => week.stamps > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Carimbos por semana" description="As 12 semanas que terminam no fim do período">
          {hasStamps ? (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.stampsByWeek} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="weekStart" {...AXIS_PROPS} tickFormatter={weekLabel} />
                  <YAxis {...AXIS_PROPS} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                    content={
                      <ChartTooltip
                        labelFormatter={(label) => `Semana de ${weekLabel(label)}`}
                        valueFormatter={count}
                      />
                    }
                  />
                  <Bar
                    dataKey="stamps"
                    name="Carimbos"
                    fill={SERIES_COLORS[0]}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={MAX_BAR_SIZE}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState message="Nenhum carimbo nestas semanas. Os carimbos aparecem aqui assim que o programa for ligado." />
          )}
        </ChartCard>

        <ChartCard
          title="Onde estão os cartões abertos"
          description="Hoje: quantos cartões com cada número de carimbos"
          action={
            <SeriesLegend
              items={[
                { name: "Cartões", color: SERIES_COLORS[0] },
                { name: "A 1 carimbo de um prêmio", color: SERIES_COLORS[1] },
              ]}
            />
          }
        >
          {charts.openCards.length > 0 ? (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.openCards} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis dataKey="stamps" {...AXIS_PROPS} tickFormatter={(value) => `${value}`} />
                  <YAxis {...AXIS_PROPS} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                    content={
                      <ChartTooltip
                        labelFormatter={(label) => `${label} carimbo(s)`}
                        valueFormatter={count}
                      />
                    }
                  />
                  <Bar dataKey="cards" name="Cartões" radius={[4, 4, 0, 0]} maxBarSize={MAX_BAR_SIZE}>
                    {charts.openCards.map((bucket) => (
                      <Cell key={bucket.stamps} fill={bucket.oneAway ? SERIES_COLORS[1] : SERIES_COLORS[0]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState message="Nenhum cartão aberto ainda." />
          )}
        </ChartCard>
      </div>

      <LoyaltyProfileCharts charts={charts} />
    </div>
  );
}

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@workspace/ui";
import { formatCount, formatDayLabel, formatFullDate } from "../lib/site-metrics";

export type SiteDailyPoint = {
  date: string;
  visitors: number;
  sessions: number;
  pageViews: number;
  reserveClicks: number;
  isLive: boolean;
};

function DailyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: SiteDailyPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const day = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="font-medium text-muted-foreground">
        {formatFullDate(day.date)}
        {day.isLive && <span className="ml-1 text-emerald-500">· ao vivo</span>}
      </p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
        {formatCount(day.visitors)} visitantes
      </p>
      <p className="text-muted-foreground">{formatCount(day.sessions)} visitas</p>
      <p className="text-muted-foreground">{formatCount(day.pageViews)} páginas vistas</p>
      <p className="text-muted-foreground">{formatCount(day.reserveClicks)} cliques em reservar</p>
    </div>
  );
}

/**
 * Visitantes por dia. Barra, e não linha: cada dia é um número fechado, e a
 * pergunta é "quantos vieram naquele dia", não uma tendência contínua. O dia
 * de hoje (ao vivo) sai mais claro, para o gráfico não terminar num "mergulho"
 * que só significa que o dia não acabou.
 */
export function SiteDailyChart({ series, periodLabel }: { series: SiteDailyPoint[]; periodLabel: string }) {
  const hasData = series.some((d) => d.visitors > 0);
  // Com mais de 45 barras o rótulo de todo dia vira tinta; mostra um a cada N.
  const tickEvery = Math.max(1, Math.ceil(series.length / 30));

  return (
    <Card className="border-border/60 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold">Visitantes por dia</h3>
        <p className="text-xs text-muted-foreground">
          {periodLabel} · a barra mais clara é hoje, ainda em andamento
        </p>
      </div>
      {hasData ? (
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeWidth={1} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDayLabel}
                interval={tickEvery - 1}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                allowDecimals={false}
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<DailyTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
              <Bar dataKey="visitors" radius={[4, 4, 0, 0]} maxBarSize={28}>
                {series.map((d) => (
                  <Cell key={d.date} fill="hsl(var(--chart-1))" opacity={d.isLive ? 0.45 : 0.9} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="py-16 text-center text-sm text-muted-foreground">
          Nenhuma visita registrada no período. O coletor do site começou a contar em 30/09/2026.
        </p>
      )}
    </Card>
  );
}

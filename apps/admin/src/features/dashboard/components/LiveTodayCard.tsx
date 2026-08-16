import React, { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, RefreshCw } from "lucide-react";
import { Card } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Skeleton } from "@workspace/ui";
import { cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { DashboardToday } from "../types";
import { compactCurrency, formatClock, formatSignedPercent, growth } from "../utils";
import { AXIS_PROPS, ChartTooltip, GRID_PROPS, MAX_BAR_SIZE, MUTED_COLOR } from "./chart-primitives";

/** Primeira hora exibida quando o dia ainda não teve venda cedo. */
const DEFAULT_FIRST_HOUR = 8;

type ComparisonChipProps = {
  label: string;
  reference: number;
  current: number;
};

/**
 * Comparativo contra uma referência do passado.
 *
 * Mostra a variação e o valor de referência juntos: a variação sozinha não diz se
 * a base era relevante, e um salto de 300% sobre dez reais não é notícia.
 */
function ComparisonChip({ label, reference, current }: ComparisonChipProps) {
  const delta = growth(current, reference);
  const isGood = (delta ?? 0) >= 0;

  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        {delta === null ? (
          <span className="text-sm text-muted-foreground">sem base</span>
        ) : (
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              isGood ? "text-emerald-400" : "text-destructive",
            )}
          >
            {formatSignedPercent(delta)}
          </span>
        )}
        <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(reference)}</span>
      </div>
    </div>
  );
}

type LiveTodayCardProps = {
  today?: DashboardToday;
  isLoading: boolean;
  isFetching: boolean;
  updatedAt: Date | null;
  onRefresh: () => void;
};

/**
 * LiveTodayCard
 *
 * Faturamento do dia corrente em tempo real, com o comparativo recortado no mesmo
 * horário e a distribuição por hora.
 *
 * As comparações usam sempre o mesmo horário do dia de referência. Confrontar o
 * acumulado das dez da manhã com o fechamento de ontem produziria uma queda que
 * não existe — e é exatamente o erro que faz um painel ao vivo perder a confiança
 * de quem olha.
 */
export function LiveTodayCard({ today, isLoading, isFetching, updatedAt, onRefresh }: LiveTodayCardProps) {
  const currentHour = new Date().getHours();

  // Recorta o eixo à janela em que a loja de fato operou hoje. Vinte e quatro
  // colunas, quase todas vazias, escondem a variação do expediente.
  const hours = useMemo(() => {
    if (!today) return [];
    const withSales = today.hours.filter((hour) => hour.revenue > 0).map((hour) => hour.hour);
    const first = Math.min(withSales[0] ?? DEFAULT_FIRST_HOUR, DEFAULT_FIRST_HOUR);
    const last = Math.max(withSales[withSales.length - 1] ?? currentHour, currentHour);
    return today.hours.slice(first, last + 1);
  }, [today, currentHour]);

  if (isLoading || !today) {
    return <Skeleton className="h-[320px] rounded-xl" />;
  }

  const hasSales = today.salesCount > 0;

  return (
    <Card className="overflow-hidden border-border/60 shadow-lg shadow-black/10">
      <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full bg-emerald-400",
                    isFetching ? "animate-ping opacity-75" : "opacity-0",
                  )}
                />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <h3 className="text-base font-semibold">Faturamento de hoje</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              aria-label="Atualizar faturamento de hoje"
              className="h-8 w-8 text-muted-foreground"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            </Button>
          </div>

          <p className="mt-4 text-5xl font-semibold leading-none tracking-tight text-foreground">
            {formatCurrency(today.revenue)}
          </p>

          <p className="mt-2 text-xs text-muted-foreground">
            {updatedAt ? `Atualizado às ${updatedAt.toLocaleTimeString("pt-BR")}` : "Carregando..."}
            {today.lastSaleAt && ` · última venda às ${formatClock(today.lastSaleAt)}`}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <ComparisonChip
              label="Ontem até agora"
              reference={today.yesterdaySameTimeRevenue}
              current={today.revenue}
            />
            <ComparisonChip
              label={
                today.weekdaySampleSize > 0
                  ? `Média de ${today.weekdaySampleSize} até agora`
                  : "Média do dia da semana"
              }
              reference={today.weekdayAverageSameTimeRevenue}
              current={today.revenue}
            />
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border/60 pt-4">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Lucro</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">{formatCurrency(today.profit)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Vendas</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">{today.salesCount}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Ticket</dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                {formatCurrency(today.averageTicket)}
              </dd>
            </div>
          </dl>

          {today.openCashRegisterSessions > 0 && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-emerald-400" />
              {today.openCashRegisterSessions} caixa(s) aberto(s) — o número ainda vai crescer
            </p>
          )}
        </div>

        <div className="flex min-h-[240px] flex-col">
          <p className="text-xs text-muted-foreground">Faturamento por hora</p>
          {hasSales ? (
            <div className="mt-2 h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hours} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid {...GRID_PROPS} />
                  <XAxis
                    dataKey="hour"
                    {...AXIS_PROPS}
                    tickFormatter={(hour: number) => `${String(hour).padStart(2, "0")}h`}
                  />
                  <YAxis {...AXIS_PROPS} tickFormatter={compactCurrency} width={48} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                    content={
                      <ChartTooltip labelFormatter={(label) => `${String(label).padStart(2, "0")}h`} />
                    }
                  />
                  <Bar dataKey="revenue" name="Faturamento" maxBarSize={MAX_BAR_SIZE} radius={[4, 4, 0, 0]}>
                    {hours.map((point) => (
                      <Cell
                        key={point.hour}
                        // A hora em curso fica destacada porque ainda está sendo
                        // preenchida: sem isso ela parece uma hora fraca.
                        fill={point.hour === currentHour ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-2 flex h-[240px] items-center justify-center rounded-lg border border-dashed border-border/60">
              <p className="text-sm" style={{ color: MUTED_COLOR }}>
                Nenhuma venda registrada hoje até agora.
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

import React from "react";
import { CalendarRange, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Skeleton } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { useSalesPatterns } from "../hooks/useSalesPatterns";
import { PATTERN_WINDOWS, type PatternWindow } from "../hooks/useSalesPatterns";
import { formatBrazilianDate } from "../utils";
import { ChartCard } from "./chart-primitives";
import { PatternChart } from "./PatternChart";

type PatternsPanelProps = ReturnType<typeof useSalesPatterns>;

/**
 * PatternsPanel
 *
 * Padrões históricos de faturamento: por dia da semana, por hora do dia e por dia
 * do mês.
 *
 * O painel começa fechado e carrega sob demanda. Por trás dele há meses de vendas
 * agregados na tabela `dashboard_sales_hourly` — o cálculo já é barato, mas ainda
 * assim é um dado que muda uma vez por dia e que a maioria dos acessos ao painel
 * não consulta. Deixá-lo fora da primeira carga é o que mantém a abertura rápida.
 */
export function PatternsPanel({
  patterns,
  enabled,
  load,
  months,
  setMonths,
  isLoading,
  isFetching,
  isError,
  refresh,
  isRefreshing,
}: PatternsPanelProps) {
  if (!enabled) {
    return (
      <ChartCard
        title="Padrões históricos"
        description="Faturamento por dia da semana, hora do dia e dia do mês"
      >
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border/60 py-10 text-center">
          <CalendarRange className="h-8 w-8 text-muted-foreground" />
          <div className="max-w-md px-4">
            <p className="text-sm text-foreground">
              Descubra em que dias e horários a loja realmente fatura.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              A análise varre meses de vendas e fica fora da carga inicial para o painel abrir rápido.
            </p>
          </div>
          <Button onClick={load}>Carregar padrões</Button>
        </div>
      </ChartCard>
    );
  }

  const action = (
    <div className="flex items-center gap-2">
      <Select value={String(months)} onValueChange={(value) => setMonths(Number(value) as PatternWindow)}>
        <SelectTrigger className="h-9 w-[132px] bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PATTERN_WINDOWS.map((window) => (
            <SelectItem key={window} value={String(window)}>
              {window} meses
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing} className="h-9">
        {isRefreshing ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
        )}
        Recalcular
      </Button>
    </div>
  );

  return (
    <ChartCard
      title="Padrões históricos"
      description={
        patterns
          ? `${formatBrazilianDate(patterns.startDate)} até ${formatBrazilianDate(patterns.endDate)} · ${patterns.daysWithSales} dias com venda · ${formatCurrency(patterns.totalRevenue)}`
          : "Faturamento por dia da semana, hora do dia e dia do mês"
      }
      action={action}
    >
      {patterns?.isStale && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Há vendas registradas depois do último processamento. Use “Recalcular” para incluí-las.
        </p>
      )}

      {isError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Não foi possível carregar os padrões históricos.
        </p>
      )}

      {isLoading || !patterns ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} className="h-[300px] rounded-lg" />
          ))}
        </div>
      ) : (
        <div className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <PatternChart
              title="Por dia da semana"
              description="Média por dia em que a loja abriu"
              buckets={patterns.byWeekday}
              tickFormatter={(bucket) => bucket.label.slice(0, 3)}
            />
            <PatternChart
              title="Por hora do dia"
              description="Média diária em cada hora do expediente"
              buckets={patterns.byHour}
            />
            <PatternChart
              title="Por dia do mês"
              description="Média em cada dia do calendário"
              buckets={patterns.byMonthDay}
              tickFormatter={(bucket) => String(bucket.key)}
            />
          </div>

          {patterns.lastRefreshedAt && (
            <p className="mt-4 text-xs text-muted-foreground">
              Dados processados em {formatBrazilianDate(patterns.lastRefreshedAt)} às{" "}
              {patterns.lastRefreshedAt.split("T")[1]?.slice(0, 5)}.
            </p>
          )}
        </div>
      )}
    </ChartCard>
  );
}

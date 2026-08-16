import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@workspace/ui";
import { formatCurrency, formatPercentage } from "@workspace/core";
import type { CampaignComparisonRowDto } from "@workspace/api-client-react";
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
import { compactCurrency } from "@/features/dashboard/utils";
import type { ComparisonMetric } from "../hooks/useCampaignComparison";

type CampaignReportComparisonChartProps = {
  rows: CampaignComparisonRowDto[];
  metric: ComparisonMetric;
  metrics: ComparisonMetric[];
  onMetricChange: (value: string) => void;
  isLoading: boolean;
  /** Alguma campanha foi escolhida. Nada escolhido não é "sem dados", é "ainda não perguntou". */
  hasSelection: boolean;
};

/** Corte do rótulo do eixo. O nome inteiro continua no tooltip. */
const MAX_LABEL = 16;

/**
 * CampaignReportComparisonChart
 *
 * Barras comparando campanhas entre si na métrica escolhida.
 *
 * Faturamento e lucro em reais só são comparáveis quando as janelas têm tamanho
 * parecido: R$ 30 mil em dezembro e R$ 30 mil em fevereiro não são o mesmo
 * resultado. É por isso que "% da loja" é uma métrica de primeira classe aqui e
 * não uma nota de rodapé — 12% da loja e 25% da loja são comparáveis mesmo entre
 * meses de movimento completamente diferente.
 */
export function CampaignReportComparisonChart({
  rows,
  metric,
  metrics,
  onMetricChange,
  isLoading,
  hasSelection,
}: CampaignReportComparisonChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[420px] rounded-xl" />;
  }

  const legenda = metric.series.map((serie, index) => ({
    name: serie.name,
    color: SERIES_COLORS[index],
  }));

  const seletor = (
    <div className="flex flex-wrap items-center gap-3">
      <SeriesLegend items={legenda} />
      <Select value={metric.value} onValueChange={onMetricChange}>
        <SelectTrigger className="w-[180px] bg-background" aria-label="Métrica do comparativo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {metrics.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <ChartCard title="Comparativo entre campanhas" description={metric.description} action={seletor}>
      {!hasSelection ? (
        <ChartEmptyState message="Escolha ao menos uma campanha na lista ao lado para montar o comparativo." />
      ) : rows.length === 0 ? (
        <ChartEmptyState message="Nenhuma campanha com movimento na janela selecionada." />
      ) : (
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis
                dataKey="campaignName"
                {...AXIS_PROPS}
                interval={0}
                tickFormatter={(value: string) =>
                  value.length > MAX_LABEL ? `${value.slice(0, MAX_LABEL - 1)}…` : value
                }
              />
              <YAxis
                {...AXIS_PROPS}
                width={metric.kind === "money" ? 56 : 68}
                tickFormatter={(value: number) =>
                  metric.kind === "money" ? compactCurrency(value) : formatPercentage(value)
                }
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                content={
                  <ChartTooltip
                    valueFormatter={(value) =>
                      metric.kind === "money" ? formatCurrency(value) : formatPercentage(value)
                    }
                  />
                }
              />

              {metric.series.map((serie, index) => (
                <Bar
                  key={String(serie.dataKey)}
                  dataKey={String(serie.dataKey)}
                  name={serie.name}
                  fill={SERIES_COLORS[index]}
                  maxBarSize={MAX_BAR_SIZE}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}

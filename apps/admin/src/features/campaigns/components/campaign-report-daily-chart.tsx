import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { CampaignReportDailyPointDto } from "@workspace/api-client-react";
import {
  AXIS_PROPS,
  ChartCard,
  ChartEmptyState,
  GRID_PROPS,
  SERIES_COLORS,
  SURFACE_COLOR,
  SeriesLegend,
} from "@/features/dashboard/components/chart-primitives";
import { compactCurrency, formatAxisDate, formatBrazilianDate } from "@/features/dashboard/utils";

type CampaignReportDailyChartProps = {
  daily: CampaignReportDailyPointDto[];
  hasMovement: boolean;
  /** Intervalo analisado, exibido como subtítulo. */
  windowLabel: string;
  isLoading: boolean;
};

const LEGEND = [
  { name: "Campanha", color: SERIES_COLORS[0] },
  { name: "Loja", color: SERIES_COLORS[1] },
];

/**
 * Tooltip da série diária.
 *
 * Traz os resgates do dia junto dos dois faturamentos porque o número de
 * resgates é o que explica um pico: R$ 3 mil num dia podem ter vindo de trinta
 * clientes ou de dois carrinhos grandes, e a decisão de repetir a ação muda
 * conforme o caso. Ele fica fora do eixo de propósito — contagem e reais na
 * mesma escala fariam a linha de resgates rastejar no zero.
 */
function DailyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: CampaignReportDailyPointDto }>;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">
        {formatBrazilianDate(point.day)}
      </p>
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: SERIES_COLORS[0] }}
            aria-hidden
          />
          <span className="text-muted-foreground">Campanha</span>
          <span className="ml-auto font-medium tabular-nums text-foreground">
            {formatCurrency(point.campaignRevenue)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: SERIES_COLORS[1] }}
            aria-hidden
          />
          <span className="text-muted-foreground">Loja</span>
          <span className="ml-auto font-medium tabular-nums text-foreground">
            {formatCurrency(point.periodRevenue)}
          </span>
        </div>
      </div>
      <p className="mt-1.5 border-t border-border/40 pt-1.5 text-xs text-muted-foreground">
        {point.redemptions} resgate(s) no dia
      </p>
    </div>
  );
}

/**
 * CampaignReportDailyChart
 *
 * Faturamento diário da campanha contra o da loja inteira, no intervalo da
 * campanha.
 *
 * As duas séries dividem o mesmo eixo, como no painel: dar escala própria a cada
 * uma faria a campanha parecer do tamanho da loja, que é exatamente o erro de
 * leitura que este gráfico existe para evitar.
 *
 * Dias sem movimento chegam preenchidos com zero pelo backend. Isso é
 * intencional: uma série que pula do dia 3 para o dia 7 desenha uma reta
 * ascendente onde houve uma semana parada.
 */
export function CampaignReportDailyChart({
  daily,
  hasMovement,
  windowLabel,
  isLoading,
}: CampaignReportDailyChartProps) {
  if (isLoading) {
    return <Skeleton className="h-[420px] rounded-xl" />;
  }

  return (
    <ChartCard
      title="Campanha × loja, dia a dia"
      description={windowLabel}
      action={<SeriesLegend items={LEGEND} />}
    >
      {hasMovement ? (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="campaignDailyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_COLORS[0]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={SERIES_COLORS[0]} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="campaignPeriodFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES_COLORS[1]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={SERIES_COLORS[1]} stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="day" {...AXIS_PROPS} tickFormatter={formatAxisDate} minTickGap={24} />
              <YAxis {...AXIS_PROPS} tickFormatter={compactCurrency} width={56} />
              <Tooltip
                cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
                content={<DailyTooltip />}
              />

              {/*
                A loja é desenhada primeiro para ficar ATRÁS: ela é o denominador
                e quase sempre o valor maior, então na frente esconderia a
                campanha, que é o assunto do gráfico.
              */}
              <Area
                type="monotone"
                dataKey="periodRevenue"
                name="Loja"
                stroke={SERIES_COLORS[1]}
                strokeWidth={2}
                fill="url(#campaignPeriodFill)"
                activeDot={{ r: 5, strokeWidth: 2, stroke: SURFACE_COLOR }}
              />
              <Area
                type="monotone"
                dataKey="campaignRevenue"
                name="Campanha"
                stroke={SERIES_COLORS[0]}
                strokeWidth={2}
                fill="url(#campaignDailyFill)"
                activeDot={{ r: 5, strokeWidth: 2, stroke: SURFACE_COLOR }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <ChartEmptyState message="Nenhuma venda registrada no intervalo da campanha." />
      )}
    </ChartCard>
  );
}

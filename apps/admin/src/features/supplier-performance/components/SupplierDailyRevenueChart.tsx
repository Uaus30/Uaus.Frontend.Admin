import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@workspace/core";
import {
  AXIS_PROPS,
  ChartCard,
  ChartTooltip,
  GRID_PROPS,
  MUTED_COLOR,
} from "@/features/dashboard/components/chart-primitives";
import { formatAxisDate } from "@/features/dashboard/utils";
import { formatCompactCurrency } from "../lib/format";

type SupplierDailyRevenueChartProps = {
  /** Faturamento de cada dia, do mais antigo ao mais recente. */
  series: number[];
  /** Primeiro dia do período, em `yyyy-MM-dd` — é dele que saem os rótulos do eixo. */
  startDate: string;
  color: string;
};

/**
 * O ritmo do fornecedor no período.
 *
 * Uma série só, então não há legenda: o título já diz o que está plotado, e uma
 * caixa com um único quadradinho colorido repetiria o título ocupando espaço.
 * A régua da média existe porque a pergunta aqui é de constância — "vende todo
 * dia ou vendeu tudo num dia só?" — e sem referência o pico engana.
 */
export function SupplierDailyRevenueChart({ series, startDate, color }: SupplierDailyRevenueChartProps) {
  const dados = React.useMemo(() => {
    const inicio = parseIsoDate(startDate);

    return series.map((valor, indice) => {
      const dia = new Date(inicio);
      dia.setDate(dia.getDate() + indice);
      return {
        date: `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, "0")}-${String(dia.getDate()).padStart(2, "0")}`,
        revenue: valor,
      };
    });
  }, [series, startDate]);

  const media = series.length > 0 ? series.reduce((soma, valor) => soma + valor, 0) / series.length : 0;
  const pico = Math.max(...series, 0);

  return (
    <ChartCard
      title="Faturamento diário"
      description={`Pico de ${formatCurrency(pico)} · média de ${formatCurrency(media)} por dia`}
    >
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="supplier-daily-revenue" x1="0" y1="0" x2="0" y2="1">
              {/* Lavagem, nunca bloco saturado: o preenchimento é contexto, a linha é o dado. */}
              <stop offset="0%" stopColor={color} stopOpacity={0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>

          <CartesianGrid {...GRID_PROPS} />
          <XAxis dataKey="date" tickFormatter={formatAxisDate} minTickGap={24} {...AXIS_PROPS} />
          <YAxis tickFormatter={formatCompactCurrency} width={72} {...AXIS_PROPS} />

          <ReferenceLine y={media} stroke={MUTED_COLOR} strokeWidth={1} strokeOpacity={0.5} />

          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(label) => formatAxisDate(label)}
                valueFormatter={(value) => formatCurrency(value)}
              />
            }
          />

          <Area
            type="monotone"
            dataKey="revenue"
            name="Faturamento"
            stroke={color}
            strokeWidth={2}
            fill="url(#supplier-daily-revenue)"
            activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/**
 * `yyyy-MM-dd` para `Date` local sem passar pelo construtor de string.
 *
 * `new Date("2026-09-06")` é interpretado como UTC e volta um dia no Brasil —
 * a mesma armadilha que o `toDateKey` do `packages/core` evita na outra ponta.
 */
function parseIsoDate(value: string): Date {
  const [year, month, day] = value.split("T")[0].split("-").map(Number);
  return new Date(year, month - 1, day);
}

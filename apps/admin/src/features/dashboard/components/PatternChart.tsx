import React from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@workspace/core";
import type { PatternBucket } from "../types";
import { compactCurrency } from "../utils";
import { AXIS_PROPS, ChartTooltip, GRID_PROPS, MAX_BAR_SIZE } from "./chart-primitives";

type PatternChartProps = {
  title: string;
  description: string;
  buckets: PatternBucket[];
  /** Formata o rótulo do eixo; o padrão usa o rótulo que vem da API. */
  tickFormatter?: (bucket: PatternBucket) => string;
  height?: number;
};

/**
 * Tooltip dos padrões.
 *
 * Traz a média junto do total e do número de ocorrências porque a média sozinha
 * engana: "R$ 800 por domingo" pesa muito diferente se saiu de dois domingos ou
 * de cinquenta.
 */
function PatternTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: PatternBucket }> }) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0].payload;

  return (
    <div className="rounded-lg border border-border bg-popover/95 px-3 py-2 shadow-lg backdrop-blur">
      <p className="text-xs font-medium text-muted-foreground">{bucket.label}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
        {formatCurrency(bucket.averageRevenue)}
        <span className="ml-1 text-xs font-normal text-muted-foreground">em média</span>
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatCurrency(bucket.revenue)} em {bucket.occurrences} ocorrência(s)
      </p>
      <p className="text-xs text-muted-foreground">{bucket.salesCount} venda(s)</p>
    </div>
  );
}

/**
 * PatternChart
 *
 * Um dos gráficos de padrão histórico (dia da semana, hora do dia, dia do mês).
 *
 * O eixo mostra a **média por ocorrência**, não o total acumulado. Total premia
 * quem apareceu mais vezes na janela — o dia 31, que só existe em sete meses do
 * ano, sempre pareceria fraco, e a hora de pico de uma loja que abre tarde
 * pareceria irrelevante.
 *
 * A melhor barra fica destacada; as demais dividem o mesmo matiz. O destaque é do
 * assunto do gráfico, não do valor: a altura da barra já codifica quanto foi.
 */
export function PatternChart({
  title,
  description,
  buckets,
  tickFormatter,
  height = 220,
}: PatternChartProps) {
  // Baldes que nunca ocorreram não são "zero faturamento", são ausência de dado —
  // manter uma coluna vazia para eles sugere um resultado que não existe.
  const data = buckets.filter((bucket) => bucket.occurrences > 0);
  const best = data.reduce<PatternBucket | null>(
    (top, bucket) => (!top || bucket.averageRevenue > top.averageRevenue ? bucket : top),
    null,
  );

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/10 p-4">
      <div>
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {data.length === 0 ? (
        <div className="flex h-[180px] items-center justify-center">
          <p className="text-sm text-muted-foreground">Sem dados suficientes na janela.</p>
        </div>
      ) : (
        <>
          <div style={{ height }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis
                  dataKey="key"
                  {...AXIS_PROPS}
                  interval="preserveStartEnd"
                  tickFormatter={(_value, index) =>
                    tickFormatter ? tickFormatter(data[index]) : data[index]?.label ?? ""
                  }
                />
                <YAxis {...AXIS_PROPS} tickFormatter={compactCurrency} width={48} />
                <Tooltip cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }} content={<PatternTooltip />} />
                <Bar dataKey="averageRevenue" maxBarSize={MAX_BAR_SIZE} radius={[4, 4, 0, 0]}>
                  {data.map((bucket) => (
                    <Cell
                      key={bucket.key}
                      fill={
                        bucket.key === best?.key ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {best && (
            <p className="text-xs text-muted-foreground">
              Melhor: <span className="font-medium text-foreground">{best.label}</span>, com{" "}
              {formatCurrency(best.averageRevenue)} em média.
            </p>
          )}
        </>
      )}
    </div>
  );
}

import * as React from "react";
import {
  Area,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AXIS_PROPS,
  ChartCard,
  ChartEmptyState,
  ChartTooltip,
  MUTED_COLOR,
  SeriesLegend,
} from "@/features/dashboard/components/chart-primitives";
import type { AbcCurvePointDto } from "@workspace/api-client-react";
import { formatPercent } from "@/features/supplier-performance/lib/format";

type AbcConcentrationChartProps = {
  curve: AbcCurvePointDto[];
  /** Onde o acumulado cruza 80% — a fronteira da classe A no eixo de produtos. */
  classAEndsAt: number;
  /** Onde cruza 95% — o começo da cauda. */
  tailStartsAt: number | null;
};

const COR_FATURAMENTO = "hsl(var(--chart-1))";
const COR_LUCRO = "hsl(var(--chart-2))";

/**
 * A curva de concentração.
 *
 * <b>Não é o gráfico de Pareto clássico, de propósito.</b> Aquele põe barras em
 * reais e a linha acumulada em porcentagem em DOIS eixos, e o alinhamento entre
 * as duas escalas é arbitrário — o desenho passa a sugerir uma relação que não
 * está no dado. Aqui os dois eixos são percentuais acumulados: o X é a fatia do
 * catálogo, o Y é a fatia do resultado. Um eixo só, e duas séries que dividem a
 * mesma escala.
 *
 * A diagonal é a referência que dá sentido à curva: sobre ela, todo produto
 * venderia igual. Quanto mais a curva se afasta dela, mais concentrada é a loja
 * — é a leitura de Lorenz, a mesma de que sai o índice de Gini do cabeçalho.
 *
 * As duas séries juntas respondem o que a curva de faturamento sozinha não
 * responde: quando a de lucro corre ABAIXO, os produtos que mais faturam não são
 * os que mais lucram.
 */
export function AbcConcentrationChart({ curve, classAEndsAt, tailStartsAt }: AbcConcentrationChartProps) {
  const dados = React.useMemo(
    () =>
      curve.map((ponto) => ({
        ...ponto,
        // A diagonal é calculada, e não uma série do servidor: ela é sempre
        // x = y, e mandá-la pela rede seria transmitir a identidade.
        equality: ponto.productShare,
      })),
    [curve],
  );

  if (dados.length === 0) {
    return (
      <ChartCard title="Curva de concentração">
        <ChartEmptyState message="Nenhuma venda no período — sem vendas não há curva a desenhar." />
      </ChartCard>
    );
  }

  return (
    <ChartCard
      title="Curva de concentração"
      description="Quanto do resultado se acumula conforme o catálogo é percorrido, do maior para o menor"
    >
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={dados} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="abc-revenue-wash" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COR_FATURAMENTO} stopOpacity={0.16} />
              <stop offset="100%" stopColor={COR_FATURAMENTO} stopOpacity={0.01} />
            </linearGradient>
          </defs>

          {/* As faixas A/B/C ficam ATRÁS das linhas: elas são contexto, e um
              retângulo por cima da curva roubaria a leitura da própria curva. */}
          <ReferenceArea x1={0} x2={classAEndsAt} fill="hsl(25 92% 48%)" fillOpacity={0.07} />
          {tailStartsAt !== null && (
            <ReferenceArea x1={tailStartsAt} x2={100} fill={MUTED_COLOR} fillOpacity={0.07} />
          )}

          <XAxis
            dataKey="productShare"
            type="number"
            domain={[0, 100]}
            ticks={[0, 20, 40, 60, 80, 100]}
            tickFormatter={(valor: number) => `${valor}%`}
            {...AXIS_PROPS}
          />
          <YAxis
            type="number"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tickFormatter={(valor: number) => `${valor}%`}
            width={44}
            {...AXIS_PROPS}
          />

          {/* Os 80% do acumulado: é a linha que define a classe A. */}
          <ReferenceLine y={80} stroke={MUTED_COLOR} strokeWidth={1} strokeOpacity={0.5} />
          <ReferenceLine x={classAEndsAt} stroke={MUTED_COLOR} strokeWidth={1} strokeOpacity={0.5} />

          <Tooltip
            content={
              <ChartTooltip
                labelFormatter={(label) => `${formatPercent(Number(label))} do catálogo`}
                valueFormatter={(valor) => formatPercent(valor)}
              />
            }
          />

          <Line
            type="monotone"
            dataKey="equality"
            name="Se todos vendessem igual"
            stroke={MUTED_COLOR}
            strokeWidth={1.5}
            strokeOpacity={0.55}
            dot={false}
            activeDot={false}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="revenueShare"
            name="Faturamento"
            stroke={COR_FATURAMENTO}
            strokeWidth={2}
            fill="url(#abc-revenue-wash)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
          />
          <Line
            type="monotone"
            dataKey="profitShare"
            name="Lucro"
            stroke={COR_LUCRO}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <SeriesLegend
        items={[
          { name: "Faturamento", color: COR_FATURAMENTO },
          { name: "Lucro", color: COR_LUCRO },
          { name: "Se todos vendessem igual", color: MUTED_COLOR },
        ]}
      />

      <p className="text-xs leading-relaxed text-muted-foreground">
        Quanto mais a curva se afasta da diagonal, mais concentrada é a loja. Onde a linha do lucro corre
        abaixo da do faturamento, os produtos que mais vendem não são os que mais lucram.
      </p>
    </ChartCard>
  );
}

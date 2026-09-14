import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ProductPerformancePointDto } from "@workspace/api-client-react";
import { formatIsoDate } from "@/features/supplier-performance/lib/format";

type ScoreHistoryChartProps = {
  history: ProductPerformancePointDto[];
  standoutScore: number;
  steadyScore: number;
};

/**
 * A série da nota, dia a dia.
 *
 * <b>É o gráfico que responde "o que eu fiz funcionou".</b> Queimou o estoque,
 * subiu o preço, comprou semelhantes — o efeito aparece aqui, e em nenhum outro
 * lugar do sistema.
 *
 * As duas linhas horizontais são os cortes das faixas (Destaque e Regular), e
 * não grade decorativa: sem elas, subir de 38 para 44 e subir de 50 para 56 têm
 * a mesma cara, quando a primeira mudou a situação do produto e a segunda não.
 *
 * O eixo vai de 0 a 100 fixo, de propósito. Escala automática faria uma variação
 * de dois pontos parecer um tombo — é o jeito mais rápido de um gráfico mentir.
 */
export function ScoreHistoryChart({ history, standoutScore, steadyScore }: ScoreHistoryChartProps) {
  const dados = history.map((ponto) => ({
    dia: formatIsoDate(ponto.date).slice(0, 5),
    data: ponto.date,
    nota: ponto.score,
    posicao: ponto.rank,
    de: ponto.analysedProducts,
  }));

  return (
    <ResponsiveContainer width="100%" height={230}>
      <LineChart data={dados} margin={{ top: 8, right: 12, bottom: 4, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />

        <XAxis
          dataKey="dia"
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={false}
        />

        <ReferenceLine y={standoutScore} stroke="#10b981" strokeDasharray="4 4" strokeOpacity={0.7} />
        <ReferenceLine y={steadyScore} stroke="#f59e0b" strokeDasharray="4 4" strokeOpacity={0.7} />

        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(_, carga) => formatIsoDate(carga?.[0]?.payload?.data)}
          formatter={(valor, _nome, carga) => [
            `${Number(valor).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}` +
              (carga?.payload?.posicao ? ` · ${carga.payload.posicao}º de ${carga.payload.de}` : ""),
            "Nota",
          ]}
        />

        <Line
          type="monotone"
          dataKey="nota"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={dados.length <= 30 ? { r: 2.5 } : false}
          // Sem animação: o navegador embutido não roda requestAnimationFrame com
          // a aba visível, e a linha congelaria no primeiro quadro.
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

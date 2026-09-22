import { cn } from "@workspace/ui";
import type { ProfitBucketDto } from "@workspace/api-client-react";

type ProfitSparklineProps = {
  /** Lucro por intervalo, na mesma ordem de `buckets`. */
  history: number[];
  buckets: ProfitBucketDto[];
  /** Descrição para quem não enxerga o desenho. */
  label: string;
  className?: string;
};

const LARGURA = 132;
const ALTURA = 30;
const MARGEM = 3;

/**
 * O histórico de um produto em um desenho do tamanho de uma linha de tabela.
 *
 * <b>SVG à mão, e não biblioteca de gráfico.</b> São até 60 instâncias numa
 * página só; montar 60 gráficos de uma biblioteca de charts é peso que a loja
 * sente no celular, para desenhar uma polilinha de treze pontos.
 *
 * <b>O intervalo parcial sai tracejado.</b> O último quase sempre é — em 30 dias
 * a quinta semana cobre dois dias —, e sem a distinção o gráfico de TODO produto
 * da tela termina num mergulho que não aconteceu. Quem olha o fim da linha está
 * justamente decidindo se o produto ainda vende.
 *
 * A cor vem do `currentColor` do pai, que é quem sabe o tom da linha.
 */
export function ProfitSparkline({ history, buckets, label, className }: ProfitSparklineProps) {
  if (history.length < 2 || history.length !== buckets.length) return null;

  const maximo = Math.max(...history, 0);
  const alturaUtil = ALTURA - MARGEM * 2;

  const pontos = history.map((valor, i) => ({
    x: (i / (history.length - 1)) * (LARGURA - MARGEM * 2) + MARGEM,
    // Sem venda em nenhum intervalo, a linha fica rente à base em vez de dividir
    // por zero — e continua dizendo a verdade: não houve lucro.
    y: MARGEM + alturaUtil - (maximo > 0 ? (valor / maximo) * alturaUtil : 0),
    parcial: buckets[i]!.isPartial,
  }));

  const area = [
    `M ${pontos[0]!.x} ${ALTURA - MARGEM}`,
    ...pontos.map((p) => `L ${p.x} ${p.y}`),
    `L ${pontos[pontos.length - 1]!.x} ${ALTURA - MARGEM}`,
    "Z",
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${LARGURA} ${ALTURA}`}
      width={LARGURA}
      height={ALTURA}
      role="img"
      aria-label={label}
      className={cn("overflow-visible", className)}
    >
      <path d={area} fill="currentColor" opacity={0.12} />

      {pontos.slice(0, -1).map((ponto, i) => {
        const proximo = pontos[i + 1]!;
        const parcial = ponto.parcial || proximo.parcial;

        return (
          <line
            key={i}
            x1={ponto.x}
            y1={ponto.y}
            x2={proximo.x}
            y2={proximo.y}
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray={parcial ? "2 2" : undefined}
            opacity={parcial ? 0.5 : 1}
          />
        );
      })}

      {/* O último ponto é o que se olha para decidir "ainda vende?" — marcado
          sempre, e vazado quando o intervalo dele ainda não fechou. */}
      <circle
        cx={pontos[pontos.length - 1]!.x}
        cy={pontos[pontos.length - 1]!.y}
        r={2.2}
        fill={pontos[pontos.length - 1]!.parcial ? "var(--background)" : "currentColor"}
        stroke="currentColor"
        strokeWidth={1.2}
      />
    </svg>
  );
}

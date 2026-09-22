import { cn } from "@workspace/ui";
import type { ProfitBucketDto } from "@workspace/api-client-react";

type ProfitSparklineProps = {
  /** Lucro por intervalo, na mesma ordem de `buckets`. */
  history: number[];
  buckets: ProfitBucketDto[];
  /** Descrição para quem não enxerga o desenho. */
  label: string;
  className?: string;
  /** Largura do desenho. Padrão: o compacto de uma linha de tabela. */
  width?: number;
  /** Altura do desenho. Padrão: o compacto de uma linha de tabela. */
  height?: number;
};

const LARGURA_PADRAO = 132;
const ALTURA_PADRAO = 30;
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
export function ProfitSparkline({
  history,
  buckets,
  label,
  className,
  width = LARGURA_PADRAO,
  height = ALTURA_PADRAO,
}: ProfitSparklineProps) {
  if (history.length < 2 || history.length !== buckets.length) return null;

  const alturaUtil = height - MARGEM * 2;

  // A escala inclui o PISO, e não só o teto. Com `Math.max` sozinho, um intervalo
  // de prejuízo — uma liquidação abaixo do custo, que o banco produz — recebia y
  // maior que a altura da caixa e era desenhado POR CIMA da linha seguinte do
  // ranking, com o `overflow-visible` deixando escapar. O zero entra sempre nas
  // duas pontas para que a linha de base signifique a mesma coisa em todo
  // gráfico da tela.
  const minimo = Math.min(...history, 0);
  const maximo = Math.max(...history, 0);
  const amplitude = maximo - minimo;

  const escala = (valor: number) =>
    // Sem amplitude (todos os intervalos em zero) a linha fica rente à base em vez
    // de dividir por zero — e continua dizendo a verdade: não houve lucro.
    amplitude > 0 ? MARGEM + alturaUtil - ((valor - minimo) / amplitude) * alturaUtil : height - MARGEM;

  const pontos = history.map((valor, i) => ({
    x: (i / (history.length - 1)) * (width - MARGEM * 2) + MARGEM,
    y: escala(valor),
    parcial: buckets[i]!.isPartial,
  }));

  // O preenchimento desce até a linha do ZERO, não até o fundo da caixa: com
  // prejuízo no período, o fundo deixa de ser o zero, e pintar até lá afirmaria
  // lucro onde houve perda.
  const baseDoZero = escala(0);

  const area = [
    `M ${pontos[0]!.x} ${baseDoZero}`,
    ...pontos.map((p) => `L ${p.x} ${p.y}`),
    `L ${pontos[pontos.length - 1]!.x} ${baseDoZero}`,
    "Z",
  ].join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      // "none": o desenho do pódio passa `className="w-full"` para esticar até
      // a largura do cartão sem manter a proporção do viewBox — é o
      // comportamento esperado de um sparkline (preencher o espaço), e sem
      // isto o SVG "letterboxa" (sobra vazio nas laterais) em vez de esticar.
      preserveAspectRatio="none"
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
          sempre, e vazado quando o intervalo dele ainda não fechou.
          `hsl(var(--card))`, e não `var(--background)`: as duas variáveis
          guardam só os TRÊS componentes do HSL (sem a função), e todo lugar
          que desenha este gráfico é uma superfície `bg-card` — a linha do
          ranking e o cartão do pódio —, não o fundo da página. */}
      <circle
        cx={pontos[pontos.length - 1]!.x}
        cy={pontos[pontos.length - 1]!.y}
        r={2.2}
        fill={pontos[pontos.length - 1]!.parcial ? "hsl(var(--card))" : "currentColor"}
        stroke="currentColor"
        strokeWidth={1.2}
      />
    </svg>
  );
}

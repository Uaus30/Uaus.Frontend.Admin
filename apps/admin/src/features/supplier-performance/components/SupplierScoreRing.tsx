import { cn } from "@workspace/ui";
import { corDaNota, rotuloDaNota } from "../lib/score";

type SupplierScoreRingProps = {
  score: number;
  /** Diâmetro em pixels. */
  size?: number;
  /** Esconde o rótulo textual — use apenas onde ele já apareça ao lado. */
  hideLabel?: boolean;
  className?: string;
};

/**
 * A nota do fornecedor: anel, número e rótulo.
 *
 * Os três canais existem juntos de propósito. A escala percorre exatamente o
 * par vermelho/verde que a deficiência de cor mais comum não distingue, então a
 * cor sozinha não pode carregar a informação — o número e o rótulo é que a
 * carregam, e a cor acelera a leitura de quem enxerga.
 *
 * Desenhado em SVG na mão, e não com a biblioteca de gráficos: são até dezenas
 * de anéis na mesma tela, e montar uma instância de Recharts para cada um só
 * atrasaria a abertura.
 */
export function SupplierScoreRing({ score, size = 54, hideLabel, className }: SupplierScoreRingProps) {
  const cor = corDaNota(score);
  const raio = size / 2 - 4.5;
  const circunferencia = 2 * Math.PI * raio;
  const fonte = Math.round(size * 0.32);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Nota ${score} de 100 — ${rotuloDaNota(score)}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={raio}
          fill="none"
          stroke="hsl(222 47% 17%)"
          strokeWidth={5.5}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={raio}
          fill="none"
          stroke={cor}
          strokeWidth={5.5}
          strokeLinecap="round"
          strokeDasharray={`${(circunferencia * Math.max(0, Math.min(100, score))) / 100} ${circunferencia}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={size / 2 + fonte / 2 - 1}
          textAnchor="middle"
          fontSize={fonte}
          fontWeight={600}
          fill={cor}
        >
          {score}
        </text>
      </svg>

      {!hideLabel && (
        <span className="mt-0.5 text-[9.5px] font-bold uppercase tracking-wide" style={{ color: cor }}>
          {rotuloDaNota(score)}
        </span>
      )}
    </div>
  );
}

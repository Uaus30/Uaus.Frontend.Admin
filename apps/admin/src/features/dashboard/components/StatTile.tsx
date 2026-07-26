import React from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatSignedPercent } from "../utils";

/**
 * Minigráfico de tendência do próprio card.
 *
 * É desenhado em SVG na mão, e não com a biblioteca de gráficos: são quatro cards
 * na primeira dobra, e montar quatro instâncias do Recharts só para uma linha sem
 * eixo, sem tooltip e sem legenda atrasa a abertura do painel sem entregar nada.
 */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;

  const width = 120;
  const height = 32;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const span = max - min || 1;

  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width;
      const y = height - ((value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
    </svg>
  );
}

type StatTileProps = {
  label: string;
  value: string;
  /**
   * Variação percentual contra o período de comparação. `null` significa que não
   * havia base — o card mostra isso em vez de inventar um número.
   */
  delta?: number | null;
  /** Nome do período comparado, exibido junto da variação. */
  deltaLabel?: string;
  /** Linha extra de contexto sob o valor. */
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Série de apoio do minigráfico. */
  trend?: number[];
  trendColor?: string;
  /**
   * Falso quando crescer é ruim (devoluções, descontos). Inverte apenas a cor,
   * nunca o sinal.
   */
  higherIsBetter?: boolean;
};

/**
 * StatTile
 *
 * Card de indicador: rótulo, valor, variação contra o período anterior e uma
 * tendência opcional.
 */
export function StatTile({
  label,
  value,
  delta,
  deltaLabel = "vs período anterior",
  hint,
  icon: Icon,
  trend,
  trendColor = "hsl(var(--chart-1))",
  higherIsBetter = true,
}: StatTileProps) {
  const isNeutral = delta === 0;
  const isPositive = (delta ?? 0) > 0;
  const isGood = higherIsBetter ? isPositive : !isPositive;

  const DeltaIcon = isNeutral ? ArrowRight : isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className="group relative overflow-hidden border-border/60 p-5 shadow-lg shadow-black/10 transition-colors hover:border-border">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <div className="rounded-lg bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">{value}</p>

      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {delta === null || delta === undefined ? (
            <span className="text-xs text-muted-foreground">Sem base de comparação</span>
          ) : (
            <>
              <DeltaIcon
                className={cn(
                  "h-4 w-4",
                  isNeutral ? "text-muted-foreground" : isGood ? "text-emerald-400" : "text-destructive",
                )}
              />
              <span
                className={cn(
                  "text-sm font-medium tabular-nums",
                  isNeutral ? "text-muted-foreground" : isGood ? "text-emerald-400" : "text-destructive",
                )}
              >
                {formatSignedPercent(delta)}
              </span>
              <span className="text-xs text-muted-foreground">{deltaLabel}</span>
            </>
          )}
        </div>

        {trend && trend.length > 1 && <Sparkline points={trend} color={trendColor} />}
      </div>
    </Card>
  );
}

import { formatCurrency } from "@workspace/core";
import type { WeekdayComparisonDto } from "@workspace/api-client-react";
import { weekdayChartScale, weekdayLabel } from "@/lib/performance";

/**
 * Semana atual sobre a anterior, barra a barra.
 *
 * Desenhado com div e CSS em vez de recharts: o PDV não tem essa dependência, e
 * puxá-la para o bundle do caixa — que hoje é um arquivo único de ~900 KB e é
 * baixado inteiro a cada deploy pelo service worker — por causa de sete barras
 * seria caro pelo que entrega.
 */
export interface WeekdayComparisonChartProps {
  days: WeekdayComparisonDto[];
}

export function WeekdayComparisonChart({ days }: WeekdayComparisonChartProps) {
  const escala = weekdayChartScale(days);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
          Semana atual x anterior
        </p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-primary" aria-hidden="true" />
            Atual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-muted-foreground/30" aria-hidden="true" />
            Anterior
          </span>
        </div>
      </div>

      <div className="flex items-end justify-between gap-1.5 h-32">
        {days.map((day) => {
          const alturaAtual = (day.revenue / escala) * 100;
          const alturaAnterior = (day.previousRevenue / escala) * 100;

          return (
            <div key={day.weekday} className="flex-1 flex flex-col items-center gap-1.5 h-full">
              <div className="flex-1 w-full flex items-end justify-center gap-[3px]">
                {/* A barra da semana anterior vem primeiro para ficar atrás na
                    leitura da esquerda para a direita, como referência. */}
                <div
                  className="w-1/2 max-w-3 rounded-t-sm bg-muted-foreground/25"
                  style={{ height: `${Math.max(alturaAnterior, day.previousRevenue > 0 ? 2 : 0)}%` }}
                  title={`${weekdayLabel(day.weekday)} da semana anterior: ${formatCurrency(day.previousRevenue)}`}
                />
                <div
                  className={`w-1/2 max-w-3 rounded-t-sm ${day.isFuture ? "bg-transparent" : "bg-primary"}`}
                  style={{ height: `${Math.max(alturaAtual, !day.isFuture && day.revenue > 0 ? 2 : 0)}%` }}
                  title={
                    day.isFuture
                      ? `${weekdayLabel(day.weekday)} ainda não chegou`
                      : `${weekdayLabel(day.weekday)}: ${formatCurrency(day.revenue)}`
                  }
                />
              </div>
              <span
                className={`text-[10px] font-mono ${
                  day.isFuture ? "text-muted-foreground/40" : "text-muted-foreground"
                }`}
              >
                {weekdayLabel(day.weekday)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

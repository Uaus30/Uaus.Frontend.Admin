import { formatCurrency } from "@workspace/core";
import type { PerformanceHourDto } from "@workspace/api-client-react";
import { hourWindow, hourlyScale } from "@/lib/performance";
import { Hint } from "./hint";

/**
 * Faturamento de hoje hora a hora — o mesmo recorte do card "Faturamento de
 * hoje" do painel administrativo, no lugar do antigo "Semana atual x anterior"
 * (pedido do dono, 04/10/2026: no balcão a pergunta é "como está o dia", e a
 * semana já aparece na linha de acumulado logo abaixo).
 *
 * Barras em CSS em vez de recharts: o PDV não tem essa dependência, e puxá-la
 * para o bundle do caixa — baixado inteiro a cada deploy pelo service worker —
 * por causa de um punhado de barras seria caro pelo que entrega.
 *
 * A hora em curso fica mais clara e com a dica "em andamento": ela ainda está
 * sendo preenchida, e sem a marca parece uma hora fraca.
 */
export interface HourlyRevenueChartProps {
  /** As 24 horas do servidor; `undefined` quando a API ainda não manda o campo. */
  hours: PerformanceHourDto[] | undefined;
  /** Hora atual no relógio da loja. */
  currentHour: number;
}

/** Rótulo "09h" de uma hora. */
function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}h`;
}

function hourHint(point: PerformanceHourDto, isCurrent: boolean): string {
  const vendas = point.salesCount === 1 ? "1 venda" : `${point.salesCount} vendas`;
  return `${hourLabel(point.hour)} — ${formatCurrency(point.revenue)} · ${vendas}${isCurrent ? " · em andamento" : ""}`;
}

export function HourlyRevenueChart({ hours, currentHour }: HourlyRevenueChartProps) {
  const janela = hourWindow(hours, currentHour);
  if (janela.length === 0) return null;

  const escala = hourlyScale(janela);
  const semVenda = janela.every((point) => point.revenue === 0);
  // Com muitas colunas, rótulo em toda hora encavala; a cada duas basta.
  const passoDoRotulo = janela.length > 10 ? 2 : 1;

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
        Faturamento por hora
      </p>

      {semVenda ? (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border/50">
          <p className="text-xs text-muted-foreground">Nenhuma venda registrada hoje até agora.</p>
        </div>
      ) : (
        <div className="flex h-32 items-end gap-1 border-b border-border/40">
          {janela.map((point) => {
            const isCurrent = point.hour === currentHour;
            const altura = point.revenue > 0 ? Math.max((point.revenue / escala) * 100, 3) : 0;

            return (
              <Hint key={point.hour} label={hourHint(point, isCurrent)}>
                <div className="flex h-full flex-1 items-end">
                  <div
                    className={`w-full rounded-t-[4px] ${isCurrent ? "bg-primary/45" : "bg-primary"}`}
                    style={{ height: `${altura}%` }}
                    aria-hidden="true"
                  />
                </div>
              </Hint>
            );
          })}
        </div>
      )}

      <div className="flex gap-1">
        {janela.map((point, index) => (
          <span
            key={point.hour}
            className={`flex-1 text-center text-[10px] font-mono ${
              point.hour === currentHour ? "text-foreground font-bold" : "text-muted-foreground"
            }`}
          >
            {index % passoDoRotulo === 0 || point.hour === currentHour ? hourLabel(point.hour) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

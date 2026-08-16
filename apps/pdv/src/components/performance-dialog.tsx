import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui";
import { BarChart3, Loader2, TrendingDown, TrendingUp } from "lucide-react";
import { describeApiError, formatCurrency } from "@workspace/core";
import { useGetStorePerformance } from "@workspace/api-client-react";
import { describePreviousDay } from "@/lib/performance";
import { WeekdayComparisonChart } from "./weekday-comparison-chart";

/**
 * Desempenho da loja — a espiada rápida pelo balcão.
 *
 * Mostra o dia corrente comparado com o último dia que teve VENDA (numa segunda,
 * o sábado; depois de um feriado, a quinta anterior), e de forma discreta o
 * acumulado da semana e do mês. A comparação vem pronta do servidor.
 *
 * Não há custo, lucro nem margem: o endpoint é liberado para o operador de caixa,
 * e o que ele precisa saber é como a loja está vendendo.
 */
export interface PerformanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Variação percentual com seta e cor, ou um traço quando não há base.
 *
 * A comparação é `== null`, com dois iguais, e o tipo aceita `undefined`: o
 * backend serializa com `WhenWritingNull`, então o campo sem valor não vem
 * `null` — ele simplesmente NÃO VEM. Com `=== null` a guarda não pegava, o
 * `toLocaleString` era chamado sobre `undefined` e a modal inteira ficava preta
 * na primeira loja sem semana anterior.
 */
function ChangeBadge({ change }: { change: number | null | undefined }) {
  if (change == null) {
    return <span className="text-xs text-muted-foreground">sem comparação</span>;
  }

  const subiu = change >= 0;
  const Icon = subiu ? TrendingUp : TrendingDown;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold font-mono ${
        subiu ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
      }`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {subiu ? "+" : ""}
      {change.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
    </span>
  );
}

/** Linha discreta de acumulado (semana, mês). */
function AccumulatedRow({
  label,
  revenue,
  change,
}: {
  label: string;
  revenue: number;
  change: number | null | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between py-2">
      <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">{label}</span>
      <div className="flex items-baseline gap-2.5">
        <span className="text-sm font-mono font-semibold">{formatCurrency(revenue)}</span>
        <ChangeBadge change={change} />
      </div>
    </div>
  );
}

export function PerformanceDialog({ open, onOpenChange }: PerformanceDialogProps) {
  // A consulta só sai quando a modal abre, e o dado é considerado fresco por um
  // minuto: o operador costuma abrir e fechar várias vezes no mesmo turno.
  const { data, isLoading, error } = useGetStorePerformance({
    query: { enabled: open, staleTime: 60_000 },
  });

  const previousDay = data
    ? describePreviousDay(data.today.revenue, data.previousSalesDay, new Date(data.referenceDate))
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-card border-border shadow-2xl">
        <div className="bg-primary/10 p-6 border-b border-border/50">
          <DialogTitle className="text-xl font-display font-bold flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" /> Desempenho
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Como a loja está vendendo hoje.
          </DialogDescription>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive py-6 text-center">{describeApiError(error)}</p>
          )}

          {data && (
            <>
              <div className="rounded-xl bg-muted/20 border border-border/30 p-5 space-y-1">
                <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">
                  Faturamento de hoje
                </p>
                <p className="text-4xl font-mono font-bold text-primary tracking-tight">
                  {formatCurrency(data.today.revenue)}
                </p>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                  {previousDay ? (
                    <>
                      <ChangeBadge change={previousDay.change} />
                      <span className="text-xs text-muted-foreground">
                        {/* A data aparece quando o dia comparado NÃO foi ontem:
                            numa segunda o operador precisa saber que a base é o
                            sábado, senão lê a variação como se fosse o domingo. */}
                        vs. {previousDay.isYesterday ? "ontem" : previousDay.label}
                        {previousDay.isYesterday
                          ? ""
                          : " (último dia com venda)"}
                      </span>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Primeiro dia de vendas — ainda não há com o que comparar.
                    </span>
                  )}
                </div>

                <div className="flex gap-5 pt-3 text-xs text-muted-foreground">
                  <span>
                    <b className="text-foreground font-mono">{data.today.salesCount}</b> venda(s)
                  </span>
                  <span>
                    ticket médio{" "}
                    <b className="text-foreground font-mono">
                      {formatCurrency(data.today.averageTicket)}
                    </b>
                  </span>
                </div>
              </div>

              <WeekdayComparisonChart days={data.weekdayComparison} />

              <div className="divide-y divide-border/40 border-t border-border/40">
                <AccumulatedRow
                  label="Semana"
                  revenue={data.week.revenue}
                  change={data.week.changePercentage}
                />
                <AccumulatedRow
                  label="Mês"
                  revenue={data.month.revenue}
                  change={data.month.changePercentage}
                />
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                Atualizado às{" "}
                {new Date(data.serverTime).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

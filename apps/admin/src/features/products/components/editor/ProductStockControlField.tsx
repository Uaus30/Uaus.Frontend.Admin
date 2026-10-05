import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@workspace/ui";
import type { StockControlDisabledReason } from "@workspace/api-client-react";
import {
  forecastStatusLabel,
  POOR_PERFORMANCE_REASON,
  STOCK_CONTROL_DISABLED_REASONS,
} from "@/lib/stock-control";
import type { StockControlState } from "../../hooks/editor/useStockControl";

type ProductStockControlFieldProps = {
  stockControl: StockControlState;
  /** Grupo com variações: o interruptor vale para todas. */
  hasVariations: boolean;
};

/** O Radix não aceita item de valor vazio: "sem motivo" precisa de um valor próprio. */
const SEM_MOTIVO = "none";

/** A mediana em texto: "3,5 por mês". */
function porMes(valor: number): string {
  return `${String(valor).replace(".", ",")} por mês`;
}

/**
 * O interruptor "Controlar estoque" (29/09/2026).
 *
 * Ligado, o produto entra no relatório de estoque baixo quando esgota, quando o
 * saldo não dura 30 dias ou quando chega ao estoque mínimo. Desligado, ele some
 * do relatório e do alerta — continua à venda. A linha de baixo conta o que a
 * rotina diária sabe dele, porque "ligado" não garante aparecer no relatório: o
 * produto que vende menos de 1 por mês fica de fora sozinho.
 */
export function ProductStockControlField({ stockControl, hasVariations }: ProductStockControlFieldProps) {
  const { view, choose, forecastStatus, monthlySalesMedian } = stockControl;
  const ligado = view.state !== "off";
  // "Desempenho fraco" só a rotina grava: entra no seletor apenas quando já é o
  // motivo do produto, senão o campo apareceria vazio.
  const pelaRotina = view.reason === POOR_PERFORMANCE_REASON.value;
  const motivo = pelaRotina
    ? POOR_PERFORMANCE_REASON
    : STOCK_CONTROL_DISABLED_REASONS.find((item) => item.value === view.reason);

  return (
    <div className="space-y-2 sm:col-span-2">
      <label className="flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border/50 bg-card px-3 text-sm transition-colors hover:bg-muted/50">
        <span className="font-medium">Controlar estoque</span>
        <Switch
          checked={ligado}
          onCheckedChange={(checked) => choose({ enabled: checked === true, reason: null })}
          aria-label="Controlar estoque"
        />
      </label>

      {view.state === "mixed" && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {view.disabledCount} de {view.total} variações estão com o controle desligado pelo relatório de
          estoque baixo. Mexer aqui vale para todas.
        </p>
      )}

      {view.state === "off" && (
        <div className="space-y-1">
          <Select
            value={view.reason ?? SEM_MOTIVO}
            onValueChange={(value) =>
              choose({
                enabled: false,
                reason: value === SEM_MOTIVO ? null : (value as StockControlDisabledReason),
              })
            }
          >
            <SelectTrigger aria-label="Motivo de desligar o controle de estoque" className="bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_MOTIVO}>Sem motivo</SelectItem>
              {pelaRotina && (
                <SelectItem value={POOR_PERFORMANCE_REASON.value}>{POOR_PERFORMANCE_REASON.label}</SelectItem>
              )}
              {STOCK_CONTROL_DISABLED_REASONS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {motivo?.hint ?? "Fora do relatório de estoque baixo e do alerta. Continua à venda."}
          </p>
        </div>
      )}

      {view.state === "on" && (
        <p className="text-xs text-muted-foreground">
          {hasVariations
            ? "Vale para todas as variações. No relatório de estoque baixo dá para desligar uma variação só."
            : forecastStatus === "LowTurnover"
              ? `Giro baixo${monthlySalesMedian != null ? ` (${porMes(monthlySalesMedian)})` : ""}: fica fora do relatório de estoque baixo enquanto vender menos de 1 por mês.`
              : forecastStatus
                ? `${forecastStatusLabel(forecastStatus)}${monthlySalesMedian != null ? ` · vende ${porMes(monthlySalesMedian)}` : ""}. Entra no relatório quando esgotar, durar menos de 30 dias ou chegar ao mínimo.`
                : "Entra no relatório de estoque baixo quando esgotar, durar menos de 30 dias ou chegar ao mínimo."}
        </p>
      )}
    </div>
  );
}

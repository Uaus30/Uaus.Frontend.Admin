import { AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useGetLowStockSummary } from "@workspace/api-client-react";
import { LOW_STOCK_REPORT_PATH } from "../low-stock-route";

type LowStockAlertProps = {
  /**
   * `banner` é a faixa do painel; `compact` é o botão vermelho ao lado do
   * "Adicionar" na listagem de produtos.
   */
  variant?: "banner" | "compact";
};

/**
 * Alerta vermelho de estoque baixo, com link para o relatório.
 *
 * Só aparece com PENDENTE maior que zero: item resolvido não conta, e sem
 * pendência não há nada a resolver — um alerta que fica sempre aceso ensina a
 * ignorá-lo. A contagem é a mesma do relatório (`/LowStock/summary`), pelo
 * mesmo hook, então painel, listagem e relatório nunca discordam do número.
 *
 * É um componente com query, e não uma prop da página, de propósito: ele mora
 * em duas telas (painel e produtos) e as duas mostrariam exatamente o mesmo
 * dado. Repetir a query em cada hook de página seria a duplicata que diverge.
 */
export function LowStockAlert({ variant = "banner" }: LowStockAlertProps) {
  const { data } = useGetLowStockSummary();
  const pending = data?.pending ?? 0;

  if (pending <= 0) return null;

  const texto = pending === 1 ? "1 produto com estoque baixo" : `${pending} produtos com estoque baixo`;

  if (variant === "compact") {
    return (
      <Link
        href={LOW_STOCK_REPORT_PATH}
        data-testid="low-stock-alert"
        className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {texto}
        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
      </Link>
    );
  }

  return (
    <Link
      href={LOW_STOCK_REPORT_PATH}
      data-testid="low-stock-alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive transition-colors hover:bg-destructive/20"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          <strong>{texto}</strong> — há reposição pendente. Abra o relatório para tratar item a item.
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

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
 * Alerta vermelho de reposição, com link para o relatório.
 *
 * ## O que ele conta (29/09/2026)
 *
 * O MESMO número do relatório sem filtro (`restock`): produtos controlados que
 * esgotaram, acabam em menos de 30 dias ou chegaram ao estoque mínimo. Até ali
 * o alerta era um subconjunto — só quem vendeu no mês —, porque o relatório
 * trazia também o parado que estava acabando. Com o giro baixo saindo do
 * controle sozinho, esse ruído não chega mais à lista, e dois números para a
 * mesma pergunta só confundiam. Quem define o critério é o backend.
 *
 * É um componente com query, e não uma prop da página, de propósito: ele mora
 * em duas telas (painel e produtos) e as duas mostrariam exatamente o mesmo
 * dado. Repetir a query em cada hook de página seria a duplicata que diverge.
 */
export function LowStockAlert({ variant = "banner" }: LowStockAlertProps) {
  const { data } = useGetLowStockSummary();
  const restock = data?.restock ?? 0;

  if (restock <= 0) return null;

  const quantos = restock === 1 ? "1 produto" : `${restock} produtos`;

  if (variant === "compact") {
    return (
      <Link
        href={LOW_STOCK_REPORT_PATH}
        data-testid="low-stock-alert"
        className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {quantos} para repor
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
          Existem <strong>{quantos} para repor</strong>: esgotados, com menos de 30 dias de estoque ou no
          estoque mínimo. Acesse o relatório para visualizar os detalhes.
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

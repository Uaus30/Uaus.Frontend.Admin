import { AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { useGetLowStockSummary } from "@workspace/api-client-react";
import { lowStockRestockPath } from "../low-stock-route";

type LowStockAlertProps = {
  /**
   * `banner` é a faixa do painel; `compact` é o botão vermelho ao lado do
   * "Adicionar" na listagem de produtos.
   */
  variant?: "banner" | "compact";
};

/**
 * Alerta vermelho de reposição, com link para o relatório já filtrado.
 *
 * ## O que ele conta (06/09/2026)
 *
 * Produtos que **vendem e estão acabando** (`restock`), e não todo mundo abaixo
 * do mínimo. A contagem anterior acendia o vermelho também para item parado há
 * um ano — que não é urgência de reposição —, e um alerta que aponta para o que
 * não precisa de ação ensina a ser ignorado. Quem define o critério é o
 * backend; a tela não repete a regra nem o número de vendas.
 *
 * O link já leva o filtro de saída (`?vendas=`), para o relatório abrir com a
 * mesma pergunta que o alerta fez. Sem isso a pessoa cairia numa lista de outro
 * critério e teria de reconstruir na mão o que o alerta já sabia.
 *
 * É um componente com query, e não uma prop da página, de propósito: ele mora
 * em duas telas (painel e produtos) e as duas mostrariam exatamente o mesmo
 * dado. Repetir a query em cada hook de página seria a duplicata que diverge.
 */
export function LowStockAlert({ variant = "banner" }: LowStockAlertProps) {
  const { data } = useGetLowStockSummary();
  const restock = data?.restock ?? 0;
  const minSales = data?.restockMinSales ?? 0;

  if (restock <= 0) return null;

  const texto =
    restock === 1
      ? "1 produto com boa saída e pouco estoque"
      : `${restock} produtos com boa saída e pouco estoque`;
  const destino = lowStockRestockPath(minSales);

  if (variant === "compact") {
    return (
      <Link
        href={destino}
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
      href={destino}
      data-testid="low-stock-alert"
      className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive transition-colors hover:bg-destructive/20"
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span>
          Existem <strong>{texto}</strong> nos últimos 30 dias. Abra o relatório para encaminhar a reposição.
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

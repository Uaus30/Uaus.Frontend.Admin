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
 * ## O que ele conta (12/09/2026)
 *
 * Produtos que **venderam nos últimos 30 dias** e estão **esgotados ou acabam em
 * menos de trinta** (`restock`). Não é todo mundo abaixo do mínimo: aquela
 * contagem acendia o vermelho também para item parado há um ano, e um alerta que
 * aponta para o que não precisa de ação ensina a ser ignorado. Quem define o
 * critério é o backend; a tela não repete a regra nem número nenhum.
 *
 * O link abre o relatório **sem filtro**, e isso é deliberado: a contagem é um
 * subconjunto do relatório, que mostra também quem atingiu o estoque mínimo e
 * quem está acabando sem ter vendido no mês. Filtrar a lista para "bater" com o
 * número esconderia o resto do que precisa de compra — e o que o alerta conta
 * aparece no topo de qualquer forma, porque a lista ordena pelo que acaba antes.
 *
 * É um componente com query, e não uma prop da página, de propósito: ele mora
 * em duas telas (painel e produtos) e as duas mostrariam exatamente o mesmo
 * dado. Repetir a query em cada hook de página seria a duplicata que diverge.
 */
export function LowStockAlert({ variant = "banner" }: LowStockAlertProps) {
  const { data } = useGetLowStockSummary();
  const restock = data?.restock ?? 0;

  if (restock <= 0) return null;

  // A frase separa as duas condições em vez de colá-las: "vendeu nos últimos 30
  // dias" é uma coisa, "está acabando" é outra, e a janela pertence só à
  // primeira. Grudadas, a leitura sugeria que o estoque também era dos 30 dias.
  const quantos = restock === 1 ? "1 produto" : `${restock} produtos`;

  if (variant === "compact") {
    return (
      <Link
        href={LOW_STOCK_REPORT_PATH}
        data-testid="low-stock-alert"
        className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {quantos} vendendo e acabando
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
          Existem <strong>{quantos} com venda nos últimos 30 dias</strong> esgotados ou com menos de 30 dias
          de estoque. Acesse o relatório para visualizar os detalhes.
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

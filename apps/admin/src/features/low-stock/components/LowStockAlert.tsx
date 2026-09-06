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
 * O link já leva o filtro de saída (`?vendas=`), e o backend trata esse filtro
 * sozinho como "vende E está acabando" — o mesmo par de condições da contagem.
 * É o que faz o número do alerta e o tamanho da lista baterem; antes o filtro
 * abria a consulta sobre o catálogo inteiro, e o alerta dizia doze enquanto a
 * tela mostrava páginas.
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

  // A frase separa as duas condições em vez de colá-las: "boa saída nos últimos
  // 30 dias" é uma coisa, "pouco estoque" é outra, e a janela pertence só à
  // primeira. Grudadas, a leitura sugeria que o estoque também era dos 30 dias.
  const quantos = restock === 1 ? "1 produto" : `${restock} produtos`;
  const destino = lowStockRestockPath(minSales);

  if (variant === "compact") {
    return (
      <Link
        href={destino}
        data-testid="low-stock-alert"
        className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        {quantos} com boa saída e pouco estoque
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
          Existem <strong>{quantos} com boa saída nos últimos 30 dias</strong> e pouco estoque. Acesse o
          relatório para visualizar os detalhes.
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0" />
    </Link>
  );
}

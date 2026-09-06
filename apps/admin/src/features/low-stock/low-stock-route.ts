/**
 * Caminho do relatório de estoque baixo.
 *
 * Vive aqui, e não como string no `routes.ts`, porque três lugares apontam para
 * ele — a rota, o alerta do painel e o alerta do topo da listagem de produtos.
 * String repetida diverge no primeiro rename, e o sintoma é um link vermelho
 * que leva ao "não encontrado".
 */
export const LOW_STOCK_REPORT_PATH = "/relatorios/estoque-baixo";

/** Parâmetro que abre o relatório já filtrado por saída: `?vendas=3`. */
export const LOW_STOCK_SALES_PARAM = "vendas";

/**
 * Caminho do relatório já filtrado pelo mínimo de vendas do alerta.
 *
 * O alerta fala de produtos "com boa saída e pouco estoque"; cair no relatório
 * sem filtro nenhum entregaria uma lista com outro critério, e a pessoa teria
 * de reconstruir na mão o que o alerta já sabia. O filtro fica VISÍVEL no campo
 * da tela, editável — é um ponto de partida, não uma prisão.
 */
export function lowStockRestockPath(minSales: number): string {
  return `${LOW_STOCK_REPORT_PATH}?${LOW_STOCK_SALES_PARAM}=${minSales}`;
}

/** O `?vendas=` da URL atual, como texto para o campo. Vazio quando não há. */
export function salesFilterFromUrl(): string {
  if (typeof window === "undefined") return "";

  const bruto = new URLSearchParams(window.location.search).get(LOW_STOCK_SALES_PARAM);
  const numero = Number(bruto);
  return bruto !== null && Number.isInteger(numero) && numero > 0 ? String(numero) : "";
}

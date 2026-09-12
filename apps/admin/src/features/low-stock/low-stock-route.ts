/**
 * Caminho do relatório de estoque baixo.
 *
 * Vive aqui, e não como string no `routes.ts`, porque três lugares apontam para
 * ele — a rota, o alerta do painel e o alerta do topo da listagem de produtos.
 * String repetida diverge no primeiro rename, e o sintoma é um link vermelho
 * que leva ao "não encontrado".
 *
 * O `?vendas=` que o alerta mandava saiu em 12/09/2026, junto com os filtros
 * semeados: o relatório passou a ter critério próprio (esgotado que vende,
 * mínimo atingido ou saldo para menos de 30 dias) e o alerta conta um
 * SUBCONJUNTO dele. Abrir a lista filtrada escondia justamente o resto do que
 * precisa de compra — e o que o alerta conta já aparece no topo, porque a lista
 * ordena pelo que acaba antes.
 */
export const LOW_STOCK_REPORT_PATH = "/relatorios/estoque-baixo";

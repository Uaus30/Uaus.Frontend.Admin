/**
 * Caminho do relatório de estoque baixo.
 *
 * Vive aqui, e não como string no `routes.ts`, porque três lugares apontam para
 * ele — a rota, o alerta do painel e o alerta do topo da listagem de produtos.
 * String repetida diverge no primeiro rename, e o sintoma é um link vermelho
 * que leva ao "não encontrado".
 */
export const LOW_STOCK_REPORT_PATH = "/relatorios/estoque-baixo";

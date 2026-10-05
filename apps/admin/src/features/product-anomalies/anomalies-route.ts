/**
 * Caminho da tela BI › Anomalias.
 *
 * Vive aqui, e não como string no `routes.ts`, porque mais de um lugar aponta
 * para ele — a rota e o atalho da listagem de produtos (05/10/2026). String
 * repetida diverge no primeiro rename, e o sintoma é um botão que leva ao "não
 * encontrado".
 */
export const PRODUCT_ANOMALIES_PATH = "/bi/anomalias";

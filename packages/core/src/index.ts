/**
 * @workspace/core — regras de domínio compartilhadas entre o Admin e o PDV.
 *
 * O que entra aqui: lógica pura que os dois apps precisam calcular do MESMO
 * jeito — dinheiro, datas, texto de busca, máscaras e a leitura de erro da API.
 *
 * O que NÃO entra: chamada HTTP (é `@workspace/api-client-react`), componente
 * visual (é `@workspace/ui`) e montagem de cupom (é `@workspace/receipt`).
 *
 * A regra existe porque duplicata neste repositório já divergiu na prática:
 * `round2` chegou a ter três algoritmos que davam centavos diferentes entre a
 * tela do caixa, o payload da venda e o cupom impresso.
 */

export * from "./api-error";
export * from "./format";
export * from "./mask";
export * from "./money";
export * from "./text";

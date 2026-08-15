/**
 * Contas do fechamento da venda.
 *
 * Ficam aqui, fora da tela, porque são regras de dinheiro: precisam de teste, e
 * testá-las dentro do componente exigiria renderizar o PDV inteiro.
 *
 * `round2` e `parseAmount` moraram aqui até o `@workspace/core` existir. São
 * reexportados para os call sites do PDV não mudarem, mas a implementação é uma
 * só no monorepo — havia cinco, com três algoritmos que divergiam em centavos.
 */

import { parseAmount, round2 } from "@workspace/core";

export { parseAmount, round2 };

/** Conferência do dinheiro em mãos contra a parte em dinheiro da venda. */
export interface CashSettlement {
  /**
   * Valor recebido, ou `null` quando o campo está vazio ou ilegível — e também
   * quando a venda não tem parcela em dinheiro.
   *
   * Campo vazio significa "recebi o valor exato" e é aceito.
   */
  received: number | null;
  /** Troco a devolver. Nunca negativo. */
  change: number;
  /** Quanto ainda falta o cliente entregar. Nunca negativo. */
  shortfall: number;
}

/**
 * Confere o dinheiro recebido contra a parte em dinheiro da venda.
 *
 * `change` e `shortfall` são excludentes: um deles é sempre zero. Separá-los é o
 * ponto — o troco é limitado a zero para não sair negativo no cupom, e era esse
 * limite que escondia a falta. Informar R$ 10,00 numa venda de R$ 11,50 mostrava
 * troco zero, e a venda era finalizada com o caixa recebendo menos do que cobrou.
 *
 * @param cashAmount Parte da venda a ser paga em dinheiro, ou `null` quando não há.
 * @param receivedText Valor recebido, como o operador digitou.
 */
export function computeCashSettlement(
  cashAmount: number | null,
  receivedText: string,
): CashSettlement {
  if (cashAmount === null || !receivedText.trim()) {
    return { received: null, change: 0, shortfall: 0 };
  }

  const parsed = parseAmount(receivedText);
  if (Number.isNaN(parsed)) {
    // Texto ilegível é tratado como campo não preenchido: bloquear a venda por
    // um erro de digitação num campo opcional só atrapalharia o balcão.
    return { received: null, change: 0, shortfall: 0 };
  }

  const received = round2(parsed);
  const difference = round2(received - cashAmount);

  return {
    received,
    change: Math.max(0, difference),
    shortfall: Math.max(0, -difference),
  };
}

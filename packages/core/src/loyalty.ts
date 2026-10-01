/**
 * Cartão fidelidade: as contas que o caixa mostra (01/10/2026).
 *
 * Quem decide o carimbo e o prêmio é o servidor (`LoyaltyService`); estas
 * funções só respondem o que a tela pergunta antes de fechar a venda — quanto
 * falta para o carimbo — e como desenhar o cartão digital depois dela.
 */

import { round2 } from "./money";

/**
 * O carrinho em relação ao mínimo do carimbo. O mínimo conta a compra ANTES do
 * prêmio do cartão: a compra que troca os R$ 5 também carimba.
 *
 * @param purchaseBeforePrize Subtotal menos o desconto manual (a base do cupom),
 *   sem tirar o prêmio do cartão.
 * @param minimum O mínimo da configuração.
 */
export function stampProgress(
  purchaseBeforePrize: number,
  minimum: number,
): { earnsStamp: boolean; missing: number } {
  const missing = round2(Math.max(0, minimum - purchaseBeforePrize));
  return { earnsStamp: purchaseBeforePrize > 0 && missing === 0, missing };
}

/** Uma casa do cartão digital. */
export interface CardSlot {
  /** 1º, 2º... — o número da casa no cartão de papel. */
  number: number;
  filled: boolean;
  /** A casa do prêmio (a última do trecho). */
  prize: boolean;
}

/**
 * O trecho do cartão que a tela desenha: as casas até o próximo prêmio.
 *
 * O cartão de 10 com prêmio no 5º aparece em dois trechos de 5 casas, como o de
 * papel — com 8 carimbos, a tela mostra 6 a 10 com três preenchidas. No trecho
 * que acabou de completar (5 carimbos), mostra as 5 cheias: é o momento de
 * anunciar o prêmio.
 */
export function cardSlots(stamps: number, required: number, middle?: number | null): CardSlot[] {
  const boundaries = middle && middle > 0 && middle < required ? [middle, required] : [required];
  const filled = Math.max(0, Math.min(stamps, required));
  const end = boundaries.find((boundary) => filled <= boundary) ?? required;
  const index = boundaries.indexOf(end);
  const start = index === 0 ? 1 : boundaries[index - 1] + 1;

  const slots: CardSlot[] = [];
  for (let number = start; number <= end; number++) {
    slots.push({ number, filled: number <= filled, prize: number === end });
  }
  return slots;
}

/** Quantos carimbos faltam para o próximo prêmio (zero quando acabou de chegar nele). */
export function stampsToNextReward(stamps: number, nextRewardAt: number): number {
  return Math.max(0, nextRewardAt - stamps);
}

/** "1º", "8º" — o número ordinal do carimbo, como o operador lê no cartão de papel. */
export function ordinal(value: number): string {
  return `${value}º`;
}

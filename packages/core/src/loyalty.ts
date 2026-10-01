/**
 * Cartão fidelidade: as contas que o caixa mostra (01/10/2026).
 *
 * Quem decide o carimbo e o prêmio é o servidor (`LoyaltyService`); estas
 * funções só respondem o que a tela pergunta antes de fechar a venda — quanto
 * falta para o carimbo — e como desenhar o cartão digital depois dela.
 */

import { formatShortDate } from "./format";
import { formatCurrency, round2 } from "./money";

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

/** O prêmio do cartão como o cliente ouve: "R$ 5,00" ou "10%". */
export function formatLoyaltyPrize(percentage: boolean, value: number): string {
  return percentage ? `${value.toLocaleString("pt-BR")}%` : formatCurrency(value);
}

/** O que o extrato precisa saber de um prêmio do cartão. */
export interface LoyaltyRewardText {
  /** O prêmio do cartão completo (senão, o do meio). */
  final: boolean;
  percentage: boolean;
  discountValue: number;
  /** Quando foi trocado; nulo enquanto não foi. */
  redeemedAt?: string | null;
  expired: boolean;
  redeemUntil: string;
}

/**
 * O prêmio como o extrato o conta: "Prêmio do 5º carimbo (R$ 5,00): trocado em
 * 21/12/2026". O mesmo texto no PDV, no admin e no extrato impresso — o cliente
 * que viu um e pergunta pelo outro não pode ouvir duas versões.
 */
export function describeLoyaltyReward(
  reward: LoyaltyRewardText,
  middleStamp?: number | null,
  stampsRequired?: number,
): string {
  const at = reward.final ? stampsRequired : middleStamp;
  const name = `Prêmio${at ? ` do ${at}º carimbo` : ""} (${formatLoyaltyPrize(reward.percentage, reward.discountValue)})`;
  if (reward.redeemedAt) return `${name}: trocado em ${formatShortDate(reward.redeemedAt)}`;
  if (reward.expired) return `${name}: venceu em ${formatShortDate(reward.redeemUntil)}`;
  return `${name}: disponível até ${formatShortDate(reward.redeemUntil)}`;
}

/** Uma linha do extrato do cartão. */
export interface LoyaltyStampLine {
  /** O saldo do cartão depois desta linha: o número conferido no papel. */
  position: number;
  /** Quantos carimbos a linha dá — ou tira, no ajuste negativo. Sem valor, 1. */
  points?: number;
  /** O extra com que o cartão nasceu. */
  bonus?: boolean;
  /** O ajuste manual do admin. */
  adjustment?: boolean;
}

/**
 * O rótulo da linha no extrato: "4º", "1º e 2º (extra)", "6º a 8º (ajuste)",
 * "Tirou 1 (ajuste, fica com 4)".
 *
 * Uma linha pode valer mais de um carimbo (o ajuste de +3, o extra que leva o
 * que sobrou do cartão anterior) ou tirar carimbos. Mostrar só o saldo faria o
 * +3 parecer um carimbo só — o 6º e o 7º sumiriam do papel — e o -1 parecer um
 * carimbo dado, com o número repetido e data nova.
 */
export function describeLoyaltyStamp(line: LoyaltyStampLine): string {
  const points = line.points ?? 1;
  if (points < 0) return `Tirou ${-points} (ajuste, fica com ${line.position})`;

  const first = line.position - points + 1;
  const range =
    points <= 1
      ? `${line.position}º`
      : points === 2
        ? `${first}º e ${line.position}º`
        : `${first}º a ${line.position}º`;
  return `${range}${line.bonus ? " (extra)" : line.adjustment ? " (ajuste)" : ""}`;
}

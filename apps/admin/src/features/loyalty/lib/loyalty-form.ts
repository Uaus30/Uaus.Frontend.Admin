import {
  COUPON_DISCOUNT_TYPE,
  enumCode,
  type CouponDiscountTypeCode,
  type LoyaltyPeriod,
  type LoyaltySettingsDto,
  type UpdateLoyaltySettingsPayload,
} from "@workspace/api-client-react";
import {
  formatAmountInput,
  formatCurrency,
  formatLoyaltyPrize,
  parseAmountOrNull,
  toDateKey,
} from "@workspace/core";
import type { LoyaltyConfigForm, LoyaltyPeriodPreset } from "../types";

/**
 * As datas do atalho de período, no relógio da loja (`toDateKey`, nunca
 * `toISOString`, que voltaria um dia no Brasil). "Todo o período" vai sem datas.
 */
export function periodFor(preset: LoyaltyPeriodPreset, today: Date = new Date()): LoyaltyPeriod {
  const day = (date: Date) => toDateKey(date);
  switch (preset) {
    case "this-month":
      return { from: day(new Date(today.getFullYear(), today.getMonth(), 1)), to: day(today) };
    case "last-month":
      return {
        from: day(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
        to: day(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case "90-days":
      return {
        from: day(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 89)),
        to: day(today),
      };
    default:
      return {};
  }
}

/** A configuração do servidor no formato do modal. */
export function settingsToForm(settings: LoyaltySettingsDto): LoyaltyConfigForm {
  const text = (value: number | null | undefined) => (value == null ? "" : String(value));
  const money = (value: number | null | undefined) => (value == null ? "" : formatAmountInput(value));
  return {
    stampsPerCard: text(settings.stampsPerCard),
    middleStamp: text(settings.middleStamp),
    middleDiscountType: enumCode(settings.middleDiscountType, COUPON_DISCOUNT_TYPE),
    middleDiscountValue: money(settings.middleDiscountValue),
    middleCouponId: text(settings.middleCouponId),
    finalDiscountType: enumCode(settings.finalDiscountType, COUPON_DISCOUNT_TYPE),
    finalDiscountValue: money(settings.finalDiscountValue),
    finalCouponId: text(settings.finalCouponId),
    minimumPurchaseForStamp: money(settings.minimumPurchaseForStamp),
    rewardMinimumPurchase: money(settings.rewardMinimumPurchase),
    bonusStampsOnNewCard: text(settings.bonusStampsOnNewCard),
    cardValidityMonths: text(settings.cardValidityMonths),
    rewardGraceDays: text(settings.rewardGraceDays),
  };
}

/**
 * Confere o modal e monta o pedido. As mesmas recusas do servidor
 * (`UpdateLoyaltySettingsRequest`), para o erro aparecer antes do clique ir à
 * rede.
 *
 * @returns O pedido, ou a primeira frase de erro.
 */
export function formToPayload(
  form: LoyaltyConfigForm,
): { payload: UpdateLoyaltySettingsPayload } | { error: string } {
  const integer = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN);
  const stamps = integer(form.stampsPerCard);
  if (!(stamps >= 2 && stamps <= 30)) return { error: "O cartão precisa ter de 2 a 30 carimbos." };

  const middle = form.middleStamp.trim() ? integer(form.middleStamp) : null;
  if (middle !== null && !(middle >= 1 && middle < stamps))
    return { error: `O prêmio do meio precisa ficar entre o 1º e o ${stamps - 1}º carimbo.` };

  const prize = (type: number, value: string, label: string) => {
    const amount = parseAmountOrNull(value);
    if (amount === null || Number.isNaN(amount) || amount <= 0) return `Informe o valor do prêmio ${label}.`;
    if (type === COUPON_DISCOUNT_TYPE.Percentage && amount > 100)
      return `O prêmio ${label} não pode passar de 100%.`;
    return null;
  };
  const prizeError =
    (middle !== null ? prize(form.middleDiscountType, form.middleDiscountValue, "do meio") : null) ??
    prize(form.finalDiscountType, form.finalDiscountValue, "do cartão completo");
  if (prizeError) return { error: prizeError };

  const minimum = parseAmountOrNull(form.minimumPurchaseForStamp) ?? 0;
  if (Number.isNaN(minimum) || minimum < 0) return { error: "Valor mínimo para o carimbo inválido." };

  const rewardMinimum = form.rewardMinimumPurchase.trim()
    ? parseAmountOrNull(form.rewardMinimumPurchase)
    : null;
  if (rewardMinimum !== null && (Number.isNaN(rewardMinimum) || rewardMinimum < 0))
    return { error: "Compra mínima do prêmio inválida." };

  const bonus = integer(form.bonusStampsOnNewCard);
  if (!(bonus >= 0 && bonus < stamps))
    return { error: "O carimbo extra precisa ser menor que os carimbos do cartão." };

  const months = integer(form.cardValidityMonths);
  if (!(months >= 1 && months <= 36)) return { error: "A validade do cartão precisa ser de 1 a 36 meses." };

  const grace = integer(form.rewardGraceDays);
  if (!(grace >= 0 && grace <= 365))
    return { error: "A folga para trocar o prêmio precisa ser de 0 a 365 dias." };

  const couponId = (value: string) => (value ? Number(value) : null);
  const middleValue = parseAmountOrNull(form.middleDiscountValue);

  return {
    payload: {
      stampsPerCard: stamps,
      middleStamp: middle,
      middleDiscountType: form.middleDiscountType as CouponDiscountTypeCode,
      // Sem prêmio do meio o servidor ainda guarda os valores: mantém os que estavam.
      middleDiscountValue: middleValue && middleValue > 0 ? middleValue : 5,
      middleCouponId: middle !== null ? couponId(form.middleCouponId) : null,
      finalDiscountType: form.finalDiscountType as CouponDiscountTypeCode,
      finalDiscountValue: parseAmountOrNull(form.finalDiscountValue) as number,
      finalCouponId: couponId(form.finalCouponId),
      minimumPurchaseForStamp: minimum,
      rewardMinimumPurchase: rewardMinimum,
      bonusStampsOnNewCard: bonus,
      cardValidityMonths: months,
      rewardGraceDays: grace,
    },
  };
}

const prize = (type: unknown, value: number) =>
  formatLoyaltyPrize(
    enumCode(type as never, COUPON_DISCOUNT_TYPE) === COUPON_DISCOUNT_TYPE.Percentage,
    value,
  );

/** A regra numa linha, como o dono a descreve: "R$ 5 no 5º e no 10º · mínimo R$ 10 · ...". */
export function describeRule(settings: LoyaltySettingsDto): string {
  const middle = settings.middleStamp
    ? `${prize(settings.middleDiscountType, settings.middleDiscountValue)} no ${settings.middleStamp}º e `
    : "";
  return [
    `${middle}${prize(settings.finalDiscountType, settings.finalDiscountValue)} no ${settings.stampsPerCard}º carimbo`,
    `mínimo de ${formatCurrency(settings.minimumPurchaseForStamp)} para carimbar`,
    `+${settings.bonusStampsOnNewCard} no cartão novo`,
    `${settings.cardValidityMonths} meses + ${settings.rewardGraceDays} dias para trocar`,
  ].join(" · ");
}

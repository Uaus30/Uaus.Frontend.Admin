import { round2 } from "@workspace/core";
import {
  formatReceiptCurrency,
  formatReceiptDateTime,
  formatReceiptQuantity,
  resolveStore,
} from "./document";
import { computeItemsSubtotal, computePromotionSavings, sanitizeReceiptNotes } from "./render";
import type { ReceiptData } from "./types";

/**
 * O comprovante em texto, para mandar pelo WhatsApp (07/10/2026).
 *
 * No celular do PDV não há impressora — decisão do dono: o comprovante sai
 * **só pelo WhatsApp**. É o caso da entrega, em que o cliente nem está no
 * balcão. A conta é a MESMA do papel (`buildReceiptHtml`), linha por linha:
 * item com promoção, desconto e acréscimo; subtotal, desconto da venda e cupom;
 * total, pagamento, troco e economia. Dois comprovantes da mesma venda que não
 * fecham igual seriam pior que nenhum.
 *
 * O negrito é o do WhatsApp (`*texto*`). Valores em reais com o espaço normal
 * depois do "R$" — o inquebrável do `Intl` vira caractere estranho em alguns
 * teclados ao encaminhar a mensagem.
 */
export function buildReceiptText(data: ReceiptData): string {
  const store = resolveStore(data.store);
  const money = (value: number) => formatReceiptCurrency(value).replace(/\s/g, " ");
  const discount = data.discount ?? 0;
  const savings = computePromotionSavings(data.items);

  const lines: string[] = [`*${store.name}*`, `Comprovante da venda ${data.saleId}`];
  lines.push(formatReceiptDateTime(data.createdAt));
  if (data.cancelled) lines.push("*VENDA CANCELADA*");
  if (data.reprint) lines.push("Segunda via");
  // Número provisório: o cliente precisa saber que o número muda quando a venda
  // subir, senão ele guarda um "OFF-14" que ninguém vai achar depois.
  if (data.offline) lines.push("Venda registrada sem internet: número provisório.");

  lines.push("");
  for (const item of data.items) {
    // Mesmas parcelas e mesmos tetos do papel: ver `buildReceiptHtml`.
    const unitDiscount = Math.max(0, item.unitDiscount ?? 0);
    const unitSurcharge = Math.max(0, item.unitSurcharge ?? 0);
    const unitPromotion = Math.min(unitDiscount, Math.max(0, item.unitPromotionDiscount ?? 0));
    const unitManualDiscount = round2(unitDiscount - unitPromotion);

    // O total da linha e, embaixo, a quantidade a preço de TABELA — como no
    // papel. Sem a linha da tabela, "R$ 20,00" seguido de "Desconto - R$ 2,00"
    // parecia dar R$ 18,00: o cliente da entrega leria que o desconto não veio
    // (revisão de 07/10/2026). A unidade vai junto, porque item a peso é KG.
    const listUnitPrice = round2(item.unitPrice + unitDiscount - unitSurcharge);
    lines.push(`${item.name} — ${money(item.quantity * item.unitPrice)}`);
    lines.push(`   ${formatReceiptQuantity(item.quantity)} ${item.unit || "UN"} x ${money(listUnitPrice)}`);

    if (unitSurcharge > 0) {
      const reason = item.surchargeReason?.trim();
      lines.push(
        `   Acréscimo + ${money(round2(unitSurcharge * item.quantity))}${reason ? ` (${reason})` : ""}`,
      );
    }
    if (unitPromotion > 0) lines.push(`   Promoção - ${money(round2(unitPromotion * item.quantity))}`);
    if (unitManualDiscount > 0)
      lines.push(`   Desconto - ${money(round2(unitManualDiscount * item.quantity))}`);
  }

  lines.push("");
  const { coupon } = data;
  if (discount > 0 || coupon) lines.push(`Subtotal: ${money(computeItemsSubtotal(data.items))}`);
  if (discount > 0) lines.push(`Desconto: - ${money(discount)}`);
  if (coupon) {
    const label = coupon.label.trim();
    lines.push(`Cupom ${coupon.code}${label ? ` (${label})` : ""}: - ${money(coupon.amount)}`);
  }
  lines.push(`*TOTAL: ${money(data.total)}*`);

  if (data.payments.length > 0) {
    const payments = data.payments.map((payment) => {
      const name =
        payment.installments && payment.installments > 1
          ? `${payment.name} (${payment.installments}x)`
          : payment.name;
      return payment.amount == null ? name : `${name} ${money(payment.amount)}`;
    });
    lines.push(`Pagamento: ${payments.join(" + ")}`);
  }
  if (data.amountReceived != null) lines.push(`Recebido: ${money(data.amountReceived)}`);
  if (data.change != null) lines.push(`Troco: ${money(data.change)}`);
  if (savings > 0) lines.push(`Você economizou ${money(savings)}`);

  const notes = sanitizeReceiptNotes(data.notes);
  if (notes) lines.push(`Obs.: ${notes}`);

  if (data.loyalty) {
    const { loyalty } = data;
    lines.push("");
    lines.push(`Cartão fidelidade: ${loyalty.stamps} de ${loyalty.stampsRequired} carimbos.`);
    if (loyalty.cardCompleted) lines.push("Cartão completo! O novo já começou.");
    lines.push(
      loyalty.toNextReward > 0
        ? `Faltam ${loyalty.toNextReward} para o prêmio de ${loyalty.nextRewardLabel}.`
        : `Prêmio de ${loyalty.nextRewardLabel} liberado para a próxima compra.`,
    );
  }

  lines.push("");
  if (store.footerMessage.trim()) lines.push(store.footerMessage.trim());
  lines.push("Documento sem valor fiscal");

  return lines.join("\n");
}

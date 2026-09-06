import { round2 } from "@workspace/core";
import {
  banner,
  divider,
  escapeHtml,
  formatReceiptCurrency,
  formatReceiptDateTime,
  formatReceiptQuantity,
  resolveStore,
  row,
  sectionTitle,
  storeHeader,
  wrapPrintDocument,
} from "./document";
import type { ReceiptData, ReceiptItem } from "./types";

export { formatReceiptCurrency } from "./document";

/** Subtotal dos itens, antes do desconto da venda. */
export function computeItemsSubtotal(items: ReceiptItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return Math.round((subtotal + Number.EPSILON) * 100) / 100;
}

/**
 * Sanitiza o texto das observações eliminando redundâncias históricas
 * (como "Cancelamento: Cancelada no PDV" -> "Cancelada no PDV").
 */
export function sanitizeReceiptNotes(notes?: string | null): string {
  if (!notes) return "";
  const trimmed = notes.trim();
  return trimmed.replace(/Cancelamento:\s*Cancelad([ao])/gi, "Cancelad$1");
}

/**
 * Monta o HTML completo do cupom, pronto para ser impresso em bobina de 80mm.
 *
 * @param data Venda, itens, pagamentos e dados de identificação da loja.
 * @returns Documento HTML completo do cupom.
 */
export function buildReceiptHtml(data: ReceiptData): string {
  const store = resolveStore(data.store);
  const subtotal = computeItemsSubtotal(data.items);
  const discount = data.discount ?? 0;

  const itemRows = data.items
    .map((item) => {
      const total = formatReceiptCurrency(item.quantity * item.unitPrice);

      // Com desconto de item, a linha da quantidade mostra o preço de TABELA e
      // o abatimento da linha sai logo abaixo: "1 UN x R$ 22,00" seguido de
      // "Desconto - R$ 2,00" fecha com os R$ 20,00 da direita. Mostrar o
      // líquido ("1 UN x R$ 20,00") e ainda um desconto de R$ 2,00 sugeriria
      // R$ 18,00 — e sem linha nenhuma, que era o caso, o desconto sumia do
      // papel. Negativo vira zero: dado corrompido não pode virar acréscimo.
      const unitDiscount = Math.max(0, item.unitDiscount ?? 0);

      // O acréscimo é o serviço cobrado junto do produto e também já está dentro
      // do `unitPrice`. Tirá-lo aqui é o que faz a linha da quantidade mostrar o
      // preço do PRODUTO — sem isso, o pendrive de R$ 25,00 vendido a R$ 30,00
      // sairia como se a tabela dele fosse R$ 30,00, e o cliente não teria como
      // conferir de onde vieram os R$ 5,00.
      const unitSurcharge = Math.max(0, item.unitSurcharge ?? 0);
      const listUnitPrice = round2(item.unitPrice + unitDiscount - unitSurcharge);
      const breakdown = `${formatReceiptQuantity(item.quantity)} ${escapeHtml(item.unit || "UN")} x ${formatReceiptCurrency(listUnitPrice)}`;

      // Acréscimo antes do desconto: é a ordem em que os dois compõem o preço a
      // partir da tabela (25 + 5 − 2 = 28), e é assim que a coluna da direita
      // fecha lendo de cima para baixo.
      const surchargeReason = item.surchargeReason?.trim();
      const surchargeRow =
        unitSurcharge > 0
          ? row(
              "Acréscimo",
              `+ ${formatReceiptCurrency(round2(unitSurcharge * item.quantity))}`,
              "item-surcharge",
            ) +
            (surchargeReason ? `<div class="item-surcharge-reason">${escapeHtml(surchargeReason)}</div>` : "")
          : "";

      const discountRow =
        unitDiscount > 0
          ? row(
              "Desconto",
              `- ${formatReceiptCurrency(round2(unitDiscount * item.quantity))}`,
              "item-discount",
            )
          : "";

      // A linha do código só aparece quando a origem o conhece. A reimpressão a
      // partir da API não traz código de barras no item da venda, e uma linha
      // vazia ali seria pior do que a ausência dela.
      const barcodeLine = item.barcode?.trim()
        ? `<div class="item-barcode">${escapeHtml(item.barcode.trim())}</div>`
        : "";

      return `
        <div class="item">
          ${barcodeLine}
          ${row(escapeHtml(item.name), total, "item-head")}
          <div class="item-breakdown">${breakdown}</div>
          ${surchargeRow}
          ${discountRow}
        </div>`;
    })
    .join("");

  const paymentRows = data.payments.length
    ? data.payments
        .map((payment) => {
          const label =
            payment.installments && payment.installments > 1
              ? `${escapeHtml(payment.name)} (${payment.installments}x)`
              : escapeHtml(payment.name);
          return row(label, payment.amount == null ? "—" : formatReceiptCurrency(payment.amount));
        })
        .join("")
    : // Venda zerada pelo cupom não tem forma de pagamento nenhuma, e a seção
      // ficaria com o título solto sobre o vazio. Mesma saída do relatório de
      // caixa quando não houve recebimento.
      `<div class="row small"><span class="row-label">Nenhum pagamento registrado.</span></div>`;

  const { coupon } = data;

  // "DESCONTO CUPOM 10OFFSET26 (10%)". O rótulo já vem pronto de quem chama —
  // ver `ReceiptCoupon.label` —, e sem ele os parênteses somem em vez de saírem
  // vazios no papel.
  //
  // `row()` interpola CRU: escapar é obrigação de quem monta o rótulo. Código e
  // descrição são texto livre do cadastro e passam pelo `escapeHtml`; o rótulo
  // vai junto por consistência, mesmo nascendo de número.
  const couponLabel = coupon?.label.trim();
  const couponRow = coupon
    ? row(
        `DESCONTO CUPOM ${escapeHtml(coupon.code)}${couponLabel ? ` (${escapeHtml(couponLabel)})` : ""}`,
        `- ${formatReceiptCurrency(coupon.amount)}`,
      )
    : "";

  const couponDescriptionRow = coupon?.description?.trim()
    ? `<div class="item-breakdown">${escapeHtml(coupon.description.trim())}</div>`
    : "";

  // O Subtotal existe para que todo abatimento tenha de onde ser subtraído. Ele
  // também aparece na venda abatida SÓ pelo cupom (`discount` zerado), senão o
  // papel mostraria um desconto pendurado sem o valor cheio acima dele.
  const hasDiscountBlock = discount > 0 || coupon != null;

  const totalsRows = [
    hasDiscountBlock ? row("Subtotal", formatReceiptCurrency(subtotal)) : "",
    discount > 0 ? row("Desconto", `- ${formatReceiptCurrency(discount)}`) : "",
    // Entre o desconto e o TOTAL: é a ordem em que a conta acontece, e é assim
    // que o cliente confere de cima para baixo.
    couponRow,
    couponDescriptionRow,
    row("TOTAL", formatReceiptCurrency(data.total), "total"),
    data.amountReceived != null ? row("Valor recebido", formatReceiptCurrency(data.amountReceived)) : "",
    data.change != null ? row("Troco", formatReceiptCurrency(data.change)) : "",
  ].join("");

  const banners = [
    data.cancelled ? banner("VENDA CANCELADA", "cancelled") : "",
    data.reprint ? banner("SEGUNDA VIA") : "",
    data.offline ? banner("VENDA OFFLINE") : "",
  ].join("");

  const cleanedNotes = sanitizeReceiptNotes(data.notes);
  const notesBlock = cleanedNotes
    ? `${divider}<div class="notes"><strong>Obs.:</strong> ${escapeHtml(cleanedNotes)}</div>`
    : "";

  const operatorBlock = data.operatorName?.trim()
    ? `<div class="meta-line">Operador: ${escapeHtml(data.operatorName.trim())}</div>`
    : "";

  // O consumidor é identificado só pelo documento, numa linha única à esquerda.
  // O nome saiu do cupom junto com o campo livre de nome no PDV: quem paga
  // informa o CPF, não o nome.
  const consumerLine = escapeHtml(data.customerDocument?.trim() || "Não identificado");

  return wrapPrintDocument(
    `Cupom ${data.saleId}`,
    `  ${storeHeader(store)}

  ${banners}

  ${divider}
  ${sectionTitle("ITENS")}
  ${row("DESCRIÇÃO", "TOTAL", "items-header")}
  ${divider}
  ${itemRows}

  ${divider}
  ${totalsRows}
  ${notesBlock}

  ${divider}
  ${sectionTitle("FORMA DE PAGAMENTO")}
  ${paymentRows}

  ${divider}
  <div class="consumer">CONSUMIDOR: ${consumerLine}</div>

  ${divider}
  <div class="meta-line"><span>Cupom: ${data.saleId}</span><span>${formatReceiptDateTime(data.createdAt)}</span></div>
  ${operatorBlock}

  <div class="footer">${escapeHtml(store.footerMessage)}</div>
  <div class="fine-print">Documento sem valor fiscal</div>`,
  );
}

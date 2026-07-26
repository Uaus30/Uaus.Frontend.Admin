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
import { RECEIPT_FOOTER_MESSAGE } from "./store-info";
import type { ReceiptData, ReceiptItem } from "./types";

export { formatReceiptCurrency } from "./document";

/** Subtotal dos itens, antes do desconto da venda. */
export function computeItemsSubtotal(items: ReceiptItem[]) {
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  return Math.round((subtotal + Number.EPSILON) * 100) / 100;
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
      const breakdown = `${formatReceiptQuantity(item.quantity)} ${escapeHtml(item.unit || "UN")} x ${formatReceiptCurrency(item.unitPrice)}`;

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
        </div>`;
    })
    .join("");

  const paymentRows = data.payments
    .map((payment) => {
      const label =
        payment.installments && payment.installments > 1
          ? `${escapeHtml(payment.name)} (${payment.installments}x)`
          : escapeHtml(payment.name);
      return row(label, payment.amount == null ? "—" : formatReceiptCurrency(payment.amount));
    })
    .join("");

  const totalsRows = [
    discount > 0 ? row("Subtotal", formatReceiptCurrency(subtotal)) : "",
    discount > 0 ? row("Desconto", `- ${formatReceiptCurrency(discount)}`) : "",
    row("TOTAL", formatReceiptCurrency(data.total), "total"),
    data.amountReceived != null ? row("Valor recebido", formatReceiptCurrency(data.amountReceived)) : "",
    data.change != null ? row("Troco", formatReceiptCurrency(data.change)) : "",
  ].join("");

  const banners = [
    data.cancelled ? banner("VENDA CANCELADA", "cancelled") : "",
    data.reprint ? banner("SEGUNDA VIA") : "",
    data.offline ? banner("VENDA OFFLINE") : "",
  ].join("");

  const notesBlock = data.notes?.trim()
    ? `${divider}<div class="notes"><strong>Obs.:</strong> ${escapeHtml(data.notes.trim())}</div>`
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

  <div class="footer">${RECEIPT_FOOTER_MESSAGE}</div>
  <div class="fine-print">Documento sem valor fiscal</div>`,
  );
}

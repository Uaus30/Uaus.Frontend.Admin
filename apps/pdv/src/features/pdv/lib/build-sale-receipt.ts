import { resolveStoreInfo, type ReceiptData } from "@workspace/receipt";
import type { CompanySettingsDto } from "@workspace/api-client-react";
import { round2 } from "@workspace/core";
import type { CheckoutPayment, PdvItem, SavedSale } from "../types";

/** Tudo que o cupom da venda recém-gravada precisa saber. */
export interface BuildSaleReceiptParams {
  /** A venda como o servidor (ou a fila local) devolveu. */
  saved: SavedSale;
  /** Carrinho no momento da confirmação — ainda não zerado. */
  items: PdvItem[];
  /** Formas escolhidas no checkout. */
  payments: CheckoutPayment[];
  /** Nome de cada forma de pagamento por ID. */
  paymentMethodNameById: Record<number, string>;
  /** Desconto aplicado sobre o total da venda. */
  globalDiscount: number;
  operatorName: string;
  /** Documento digitado no balcão, usado quando a origem não devolveu um. */
  consumerDocument: string;
  /** Dinheiro recebido do cliente, ou `null` quando não houve pagamento em espécie. */
  receivedAmount: number | null;
  /** Troco calculado pelo checkout. */
  change: number;
  /** A venda é uma reedição — o cupom sai carimbado como segunda via. */
  isReedition: boolean;
  /** Identidade da loja; campo vazio cai no padrão embutido do cupom. */
  companySettings: CompanySettingsDto;
}

/**
 * Monta o cupom da venda que acabou de ser gravada.
 *
 * O cupom nasce do **carrinho**, não da resposta da API: só o carrinho tem o
 * nome dos produtos e o dinheiro que o cliente entregou em mãos. Da resposta
 * vêm apenas os campos que o servidor decide — número, data, total e
 * observações.
 *
 * Função pura de propósito: é a peça que o CRUD de Cupom vai reaproveitar para
 * gravar/consultar o cupom de uma venda, e ela precisa rodar sem tela, sem rede
 * e com teste.
 */
export function buildSaleReceipt({
  saved,
  items,
  payments,
  paymentMethodNameById,
  globalDiscount,
  operatorName,
  consumerDocument,
  receivedAmount,
  change,
  isReedition,
  companySettings,
}: BuildSaleReceiptParams): ReceiptData {
  return {
    saleId: saved.receiptNumber,
    createdAt: saved.createdAt,
    operatorName,
    customerDocument: saved.customerDocument || consumerDocument.trim() || null,
    items: items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      // O cupom imprime o preço que o cliente pagou, não o de tabela.
      unitPrice: round2(item.price - item.discount),
      barcode: item.barcode,
    })),
    payments: payments.map((payment) => ({
      name: paymentMethodNameById[payment.paymentMethodId] || "Não informado",
      amount: round2(payment.amount),
      installments: payment.installmentNumber,
    })),
    discount: globalDiscount,
    total: saved.total,
    amountReceived: receivedAmount,
    // Sem dinheiro em espécie não há troco a imprimir — e zero seria lido como
    // "recebi certo", que é outra informação.
    change: receivedAmount !== null ? change : null,
    notes: saved.notes,
    reprint: isReedition,
    offline: saved.offline,
    store: resolveStoreInfo(companySettings),
  };
}

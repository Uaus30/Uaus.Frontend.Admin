import { formatReceiptCurrency, resolveStoreInfo, type ReceiptData } from "@workspace/receipt";
import { COUPON_DISCOUNT_TYPE, type CompanySettingsDto } from "@workspace/api-client-react";
import { formatQuantity, round2 } from "@workspace/core";
import { computeCartTotals } from "@/stores/use-pdv-store";
import type { AppliedCoupon, CheckoutPayment, PdvItem, SavedSale } from "../types";

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
  /** Desconto aplicado sobre o total da venda, SEM o cupom. */
  globalDiscount: number;
  /**
   * Cupom aplicado, ou ausente/`null` quando não houve.
   *
   * Chega como definição; o valor impresso é derivado do mesmo carrinho que gerou
   * o payload, para que a linha do papel e a do banco sejam o mesmo número.
   */
  coupon?: AppliedCoupon | null;
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
 * Texto PRONTO do parâmetro do cupom — "10%" ou "R$ 20,00" — que sai entre
 * parênteses ao lado do código no impresso.
 *
 * Montado aqui, e não dentro do `@workspace/receipt`, porque o pacote do cupom
 * impresso **não depende** do cliente HTTP: quem sabe traduzir o enum
 * `CouponDiscountType` é o app. A contrapartida é que este texto tem que sair
 * IGUAL ao que `buildReceiptFromSale` monta na reimpressão a partir da venda da
 * API — senão a segunda via sai diferente da primeira, que é pior que não
 * reimprimir. Daí `formatQuantity` e `formatReceiptCurrency`, os mesmos que ele
 * usa: o percentual sem casas fixas ("10%", não "10,00%"), o valor em reais no
 * formato da bobina.
 */
function formatCouponLabel(coupon: AppliedCoupon): string {
  return coupon.discountType === COUPON_DISCOUNT_TYPE.Percentage
    ? `${formatQuantity(coupon.discountValue)}%`
    : formatReceiptCurrency(coupon.discountValue);
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
  coupon = null,
  operatorName,
  consumerDocument,
  receivedAmount,
  change,
  isReedition,
  companySettings,
}: BuildSaleReceiptParams): ReceiptData {
  // O abatimento do cupom sai da MESMA conta que gerou o payload, e o `discount`
  // impresso é só a parte manual: no papel são duas linhas, e imprimir o desconto
  // total nas duas mostraria o mesmo abatimento em dobro — `Subtotal − Desconto −
  // Cupom` daria menos que o TOTAL ao lado, na única conta que o cliente confere.
  const totals = computeCartTotals(items, globalDiscount, coupon);

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
    // Venda zerada pelo cupom não teve recebimento nenhum, e o payload sobe com a
    // lista vazia (ver `build-sale-payload.ts`). Imprimir a forma que estava
    // selecionada no checkout com R$ 0,00 colocaria no papel um pagamento que a
    // venda não tem — o impresso deixaria de reproduzir o que foi gravado.
    payments:
      totals.total === 0
        ? []
        : payments.map((payment) => ({
            name: paymentMethodNameById[payment.paymentMethodId] || "Não informado",
            amount: round2(payment.amount),
            installments: payment.installmentNumber,
          })),
    discount: totals.globalDiscount,
    coupon: coupon
      ? {
          code: coupon.code,
          description: coupon.description,
          label: formatCouponLabel(coupon),
          amount: totals.couponDiscount,
        }
      : undefined,
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

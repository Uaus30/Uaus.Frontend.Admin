import { formatQuantity, round2 } from "@workspace/core";
import { formatReceiptCurrency } from "./document";
import type { ReceiptCoupon, ReceiptData, ReceiptStore, StoreInfo } from "./types";

/**
 * Códigos do enum `CouponDiscountType` do backend.
 *
 * Repetidos aqui, e não importados de `@workspace/api-client`, porque o cupom
 * impresso não depende do cliente HTTP: ele também é montado offline, a partir
 * do snapshot local do PDV. São dois números e o nome com que a API os
 * serializa — não é regra de negócio, é leitura de JSON. Quem calcula dinheiro
 * continua sendo `computeDiscount` do `@workspace/core`, em um lugar só.
 */
const COUPON_TYPE_PERCENTAGE = 1;
const COUPON_TYPE_AMOUNT = 2;

/** Recorte de uma venda da API com o que o cupom precisa. */
export interface SaleLike {
  id: number;
  createdAt: string;
  total: number;
  /**
   * Desconto TOTAL da venda. Quando houve cupom, ele **já está incluído aqui** —
   * `couponDiscount` é uma parcela deste número, nunca uma adição.
   */
  discount: number;
  /**
   * Parcela de `discount` atribuída ao cupom.
   *
   * Opcional porque as vendas gravadas antes da feature sobem sem o campo; leia
   * sempre com `?? 0`.
   */
  couponDiscount?: number;
  /**
   * Código do cupom como saiu impresso na primeira via.
   *
   * Os cinco campos de cupom vêm do SNAPSHOT do resgate, não da definição atual
   * do cadastro. É o que faz a segunda via sair idêntica à primeira depois de o
   * cupom ser editado — e uma segunda via que discorda da primeira é pior do que
   * não reimprimir, porque o cliente tem as duas na mão.
   *
   * Ausente na venda sem cupom: o backend omite nulo do JSON.
   */
  couponCode?: string | null;
  /** Descrição do cupom, do snapshot do resgate. */
  couponDescription?: string | null;
  /**
   * Tipo do desconto no momento da venda (enum `CouponDiscountType`).
   *
   * Chega ora como nome (`"Percentage"`), ora como número — a API serializa enum
   * com `JsonStringEnumConverter`, mas a fila offline pode ter guardado o código.
   */
  couponDiscountType?: number | string | null;
  /** Percentual ou reais do cupom no momento da venda, para o rótulo "(10%)". */
  couponDiscountValue?: number | null;
  notes?: string | null;
  /**
   * Documento do consumidor resolvido pelo backend (do cadastro, quando a venda
   * tem cliente; senão o informado no balcão). É a única identificação impressa.
   */
  customerDocument?: string | null;
  /** Operador que registrou a venda. */
  userName?: string | null;
  paymentMethodName?: string | null;
  installments?: number;
  payments?: Array<{
    paymentMethodId: number;
    paymentMethodName?: string | null;
    amount: number | null;
    installments?: number;
  }> | null;
}

/** Recorte de um item de venda da API. */
export interface SaleItemLike {
  productId: number;
  productName?: string | null;
  quantity: number;
  unitPrice: number;
  /**
   * Código de barras do produto. A API não o devolve no item da venda, então na
   * reimpressão ele fica de fora e a linha do código não é impressa; o campo
   * existe para quem já tiver o dado em mãos poder repassá-lo.
   */
  barcode?: string | null;
}

/** Contexto que a venda sozinha não carrega. */
export interface SaleReceiptContext {
  /** Operador do caixa. Sobrescreve o que veio na venda. */
  operatorName?: string | null;
  /** Documento do consumidor. Sobrescreve o que veio na venda. */
  customerDocument?: string | null;
  /** Nomes das formas de pagamento por ID, para vendas antigas sem `paymentMethodName`. */
  paymentMethodNameById?: Record<number, string>;
  amountReceived?: number | null;
  change?: number | null;
  /** Marca o cupom como segunda via. */
  reprint?: boolean;
  cancelled?: boolean;
  /** Identidade da loja: a do cadastro (`resolveStoreInfo`) ou sobrescrita avulsa. */
  store?: Partial<ReceiptStore> | StoreInfo;
}

/**
 * Normaliza o tipo de desconto, que chega como nome ou como número.
 *
 * @param value Como o campo veio no JSON.
 * @returns O código do enum, ou 0 quando não dá para saber.
 */
function couponDiscountTypeCode(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  if (value === "Percentage") return COUPON_TYPE_PERCENTAGE;
  if (value === "Amount") return COUPON_TYPE_AMOUNT;

  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Monta o texto entre parênteses da linha do cupom — "10%" ou "R$ 20,00".
 *
 * O percentual sai sem casas fixas de propósito: cupom de 10% é "10%", não
 * "10,00%" — é o que estava no panfleto que o cliente trouxe.
 *
 * Snapshot incompleto (venda antiga, tipo desconhecido) devolve texto vazio, e a
 * linha sai só com o código. Inventar "(0%)" seria pior: é um número, e número
 * errado no comprovante o cliente cobra no balcão.
 *
 * @param type Tipo do desconto no momento da venda.
 * @param value Percentual ou reais no momento da venda.
 */
function formatCouponLabel(
  type: number | string | null | undefined,
  value: number | null | undefined,
): string {
  if (value == null) return "";

  const code = couponDiscountTypeCode(type);
  if (code === COUPON_TYPE_PERCENTAGE) return `${formatQuantity(value)}%`;
  if (code === COUPON_TYPE_AMOUNT) return formatReceiptCurrency(value);
  return "";
}

/**
 * Reconstrói o bloco do cupom a partir do snapshot que a venda carrega.
 *
 * O código é o que decide se houve cupom: `couponDiscount` pode ser zero num
 * cupom que não chegou a abater nada (venda já zerada por outro desconto), e
 * mesmo assim ele foi apresentado no balcão e tem que sair no papel.
 *
 * @param sale Venda retornada pela API.
 * @returns O bloco pronto para impressão, ou `undefined` na venda sem cupom.
 */
function buildReceiptCoupon(sale: SaleLike): ReceiptCoupon | undefined {
  const code = sale.couponCode?.trim();
  if (!code) return undefined;

  return {
    code,
    description: sale.couponDescription?.trim() || null,
    label: formatCouponLabel(sale.couponDiscountType, sale.couponDiscountValue),
    amount: round2(sale.couponDiscount ?? 0),
  };
}

/**
 * Converte uma venda da API no formato que o cupom consome.
 *
 * Vendas antigas (migradas ou lançadas fora do PDV) podem não ter a coleção de
 * pagamentos preenchida — nesse caso o cupom cai para a forma de pagamento
 * única da própria venda, cobrindo o total.
 *
 * O desconto do cupom é **retirado** do desconto que vai para a linha
 * "Desconto": na API os dois são o mesmo número (o cupom é parcela do desconto
 * total), mas no papel são duas linhas, e imprimir o total nas duas mostraria o
 * abatimento em dobro. Ver `ReceiptData.discount`.
 *
 * @param sale Venda retornada pela API.
 * @param items Itens da venda.
 * @param context Operador, cliente e demais dados de fora da venda.
 */
export function buildReceiptFromSale(
  sale: SaleLike,
  items: SaleItemLike[],
  context: SaleReceiptContext = {},
): ReceiptData {
  const nameById = context.paymentMethodNameById ?? {};
  const coupon = buildReceiptCoupon(sale);

  // `Math.max(0, ...)` protege contra snapshot inconsistente: cupom maior que o
  // desconto total só acontece com dado corrompido, e um desconto negativo
  // impresso viraria acréscimo aos olhos de quem lê o papel.
  const manualDiscount = round2(Math.max(0, sale.discount - (coupon?.amount ?? 0)));

  const payments =
    sale.payments && sale.payments.length > 0
      ? sale.payments.map((payment) => ({
          name: payment.paymentMethodName || nameById[payment.paymentMethodId] || "Não informado",
          amount: payment.amount,
          installments: payment.installments,
        }))
      : [
          {
            name: sale.paymentMethodName || "Não informado",
            amount: sale.total,
            installments: sale.installments,
          },
        ];

  return {
    saleId: sale.id,
    createdAt: sale.createdAt,
    operatorName: context.operatorName ?? sale.userName ?? null,
    customerDocument: context.customerDocument ?? sale.customerDocument ?? null,
    items: items.map((item) => ({
      name: item.productName || `Produto #${item.productId}`,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      barcode: item.barcode ?? null,
    })),
    payments,
    discount: manualDiscount,
    coupon,
    total: sale.total,
    amountReceived: context.amountReceived ?? null,
    change: context.change ?? null,
    notes: sale.notes ?? null,
    reprint: context.reprint,
    cancelled: context.cancelled,
    store: context.store,
  };
}

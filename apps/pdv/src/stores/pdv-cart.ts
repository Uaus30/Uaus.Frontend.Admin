import { COUPON_DISCOUNT_TYPE, type CouponDiscountTypeCode } from "@workspace/api-client-react";
import {
  computeDiscount,
  computeSaleTotals,
  round2,
  type SaleItemForTotals,
  type SaleTotals,
} from "@workspace/core";

/**
 * O carrinho do PDV como MODELO: os tipos da venda em andamento e a conta do
 * total, sem nenhum estado de tela.
 *
 * Está separado de `use-pdv-store.ts` porque o store é a máquina de estado
 * (status, vendas em espera, tema, fonte, chave de idempotência) e isto aqui é
 * função pura, testável e reaproveitável sem montar o zustand — `build-sale-payload`
 * e `build-sale-receipt` já chamavam `computeCartTotals` sem precisar do store.
 *
 * O store reexporta tudo daqui, então quem importa de `@/stores/use-pdv-store`
 * continua funcionando: a divisão é interna, não é uma segunda porta de entrada.
 */

/** Uma linha do carrinho de venda em andamento. */
export interface PdvItem {
  /** Identificador local da linha do carrinho. */
  id: string;
  productId: number;
  name: string;
  barcode?: string;
  /** Preço de tabela do produto. */
  price: number;
  quantity: number;
  /** Desconto em R$ por unidade. */
  discount: number;
  /** Estoque disponível no momento em que o item entrou no carrinho. */
  availableStock: number;
  /**
   * Caminho da imagem principal do produto, como a busca devolve, ou nulo.
   *
   * Vem junto do resultado da busca, sem requisição nova — é o mesmo dado que a
   * lista de produtos já usa na miniatura dela. Fica no item porque o carrinho
   * também é conferido no balcão: reconhecer a foto é mais rápido que ler o
   * nome, e a venda pausada volta do `localStorage` sem consultar nada.
   */
  imageUrl?: string | null;
}

/**
 * Consumidor da venda. Ou é um cliente cadastrado (`customerId`), ou é o
 * CPF/CNPJ que o operador digitou no balcão.
 */
export interface PdvConsumer {
  customerId: number | null;
  /**
   * Nome do cliente cadastrado escolhido na busca, só para o operador conferir
   * quem selecionou. Fica vazio na venda de balcão — o PDV não coleta nome — e
   * não é impresso no cupom, que identifica o consumidor pelo documento.
   */
  name: string;
  /** CPF/CNPJ do consumidor: do cadastro escolhido, ou digitado no balcão. */
  document: string;
}

/** Consumidor vazio: venda para consumidor não identificado. */
export const EMPTY_CONSUMER: PdvConsumer = { customerId: null, name: "", document: "" };

/** Uma resposta do questionário do cupom: a pergunta e a alternativa escolhida. */
export interface CouponAnswer {
  questionId: number;
  optionId: number;
}

/**
 * Cupom aplicado na venda em andamento — a **definição**, nunca o valor em reais.
 *
 * O que está guardado aqui é o que estava impresso no panfleto: código, tipo e
 * valor do desconto. O abatimento é DERIVADO do carrinho a cada leitura, por
 * {@link couponDiscountFor}.
 *
 * **Congelar o valor em reais é o erro que este desenho existe para impedir.**
 * Um cupom de 10% aplicado num carrinho de R$ 100 abate R$ 10; se o operador
 * bipar mais um produto de R$ 50 depois disso, o abatimento tem que virar R$ 15.
 * Com o valor congelado, o desconto fica parado nos R$ 10, a tela mostra um
 * número, o payload leva outro e o servidor recusa a venda por total divergente
 * — com o cliente esperando no balcão.
 *
 * As `answers` são a exceção que confirma a regra: elas não são cálculo, são o
 * que o cliente respondeu, e não mudam quando o carrinho muda.
 */
export interface AppliedCoupon {
  couponId: number;
  /** Código como o operador leu do panfleto, já em maiúsculas. */
  code: string;
  /** Descrição impressa no comprovante ao lado do código. */
  description: string | null;
  /** Código do enum `CouponDiscountType`: 1 = percentual, 2 = valor fixo. */
  discountType: CouponDiscountTypeCode;
  /** Percentual (1 a 100) ou reais, conforme {@link discountType}. */
  discountValue: number;
  /** Respostas do questionário da campanha. Vazio é o caso normal. */
  answers: CouponAnswer[];
}

/** Uma venda pausada, à espera de ser retomada. */
export interface HeldSale {
  /** Identificador local; a venda em espera ainda não existe na API. */
  id: string;
  /** Momento em que a venda foi pausada, em ISO. */
  heldAt: string;
  items: PdvItem[];
  globalDiscount: number;
  consumer: PdvConsumer;
  /**
   * Cupom que estava aplicado quando a venda foi pausada.
   *
   * Opcional na leitura porque as vendas em espera vivem no `localStorage` e
   * sobrevivem ao deploy desta feature: as que já estavam lá voltam sem o campo,
   * e é por isso que quem retoma lê com `?? null`.
   */
  coupon?: AppliedCoupon | null;
  /** Total no momento da pausa, para a lista não precisar recalcular. */
  total: number;
}

/**
 * Traduz o carrinho para o formato que `computeSaleTotals` espera.
 *
 * A conta em si mora no `@workspace/core` para o total exibido aqui ser
 * exatamente o mesmo que vai no payload da venda e no cupom impresso.
 */
export const toTotalsItems = (items: PdvItem[]): SaleItemForTotals[] =>
  items.map((item) => ({
    unitPrice: item.price,
    quantity: item.quantity,
    unitDiscount: item.discount,
  }));

/**
 * Converte a definição do cupom no abatimento em reais sobre a base informada.
 *
 * **A base é o que RESTA depois do desconto global**, não o subtotal cru: a
 * ordem de aplicação é item → global → cupom (ver `computeSaleTotals` do
 * `@workspace/core`). Um cupom de 10% numa venda de R$ 50 com R$ 5 de desconto
 * manual abate R$ 4,50, não R$ 5,00 — e é o número menor que o servidor audita e
 * que sai impresso no comprovante.
 *
 * Cupom de valor fixo maior que a base **zera a venda** em vez de ser recusado:
 * é a decisão do plano ("venda pode ser zerada, nunca negativa"), e recusar o
 * cupom de R$ 20 numa compra de R$ 15 devolveria o cliente ao balcão com o
 * panfleto na mão sem nenhum motivo defensável.
 *
 * @param coupon Cupom aplicado, ou `null` numa venda sem cupom.
 * @param base O que resta a pagar depois do desconto global.
 * @returns Reais a abater. Zero quando não há cupom ou quando a definição é
 *   ilegível (valor negativo, `NaN`) — virar acréscimo silencioso seria pior.
 */
export function couponDiscountFor(coupon: AppliedCoupon | null, base: number): number {
  if (!coupon) return 0;

  const result = computeDiscount({
    base,
    value: coupon.discountValue,
    type: coupon.discountType === COUPON_DISCOUNT_TYPE.Percentage ? "percent" : "value",
  });

  if ("error" in result) return result.error === "excede-base" ? round2(Math.max(0, base)) : 0;

  return result.amount;
}

/**
 * Totais da venda com o cupom **derivado do carrinho corrente**.
 *
 * É a única conta de total do PDV, e é ela que o carrinho exibe, o payload envia
 * e o comprovante imprime — o mesmo motivo que levou `computeSaleTotals` para o
 * `@workspace/core`: enquanto cada consumidor fazia a sua, o total da tela não
 * batia com o total gravado.
 *
 * O cupom entra em duas passadas de propósito. A primeira, sem cupom, existe só
 * para descobrir a base (`total` sem cupom **é** o subtotal menos o desconto
 * global); a segunda aplica o abatimento e deixa o próprio `computeSaleTotals`
 * limitá-lo ao que resta a pagar. Assim o número que sai daqui já é o número
 * final, e não uma intenção que alguém adiante ainda vai clampar de outro jeito.
 *
 * @param items Carrinho, com preço de tabela e desconto por unidade.
 * @param globalDiscount Desconto concedido sobre o total da venda.
 * @param coupon Cupom aplicado, ou `null`.
 */
export function computeCartTotals(
  items: PdvItem[],
  globalDiscount: number,
  coupon: AppliedCoupon | null,
): SaleTotals {
  const totalsItems = toTotalsItems(items);
  const withoutCoupon = computeSaleTotals({ items: totalsItems, globalDiscount });

  return computeSaleTotals({
    items: totalsItems,
    globalDiscount,
    couponDiscount: couponDiscountFor(coupon, withoutCoupon.total),
  });
}

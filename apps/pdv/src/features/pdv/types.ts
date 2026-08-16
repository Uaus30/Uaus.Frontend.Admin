import type { AppliedCoupon, CouponAnswer, PdvConsumer, PdvItem } from "@/stores/use-pdv-store";
import type { CheckoutPayment } from "@/hooks/use-checkout";

export type { AppliedCoupon, CouponAnswer, PdvConsumer, PdvItem, CheckoutPayment };

/**
 * Venda gravada, no formato único que a tela usa depois de confirmar o
 * pagamento.
 *
 * São três origens com respostas diferentes — a venda nova pela API, a reedição
 * (`SaleDto`) e a venda que ficou na fila offline — e nada depois da gravação
 * precisa saber de qual delas veio. Sem esta normalização, cada ramo (aviso na
 * tela, cupom, histórico) se ramificava de novo, e foi assim que o cupom da
 * reedição saiu uma vez sem o número da venda.
 */
export interface SavedSale {
  /** Número impresso no cupom: o ID do banco, ou `OFF-n` na venda offline. */
  receiptNumber: number | string;
  /** Momento da venda. */
  createdAt: string | Date;
  total: number;
  notes: string | null;
  /**
   * CPF/CNPJ que a origem devolveu. Nulo no registro: ali o documento está em
   * mãos, no carrinho, e a API não devolveria nada que o balcão já não saiba.
   */
  customerDocument: string | null;
  /** A venda ficou na fila local em vez de ir ao servidor. */
  offline: boolean;
}

/** Uma alternativa de resposta, como ela vira botão no balcão. */
export interface CouponQuestionOption {
  optionId: number;
  label: string;
}

/**
 * Uma pergunta do questionário **já resolvida**: o PDV não sabe (nem precisa
 * saber) de qual campanha ela veio — quem fotografa o vínculo é o servidor, na
 * gravação da venda.
 */
export interface CouponQuestion {
  questionId: number;
  label: string;
  /** Sem resposta desta pergunta o cupom não pode ser aplicado. */
  isRequired: boolean;
  /** De duas a oito alternativas. No balcão viram botões grandes, sem teclado. */
  options: CouponQuestionOption[];
}

/**
 * Cupom encontrado na consulta, **antes** de ser aplicado na venda.
 *
 * É o formato único das duas origens — `GET /Pdv/coupons/{code}` e a base local
 * do modo offline. Um formato só é o que permite ao diálogo ter um caminho de
 * renderização, e não dois que divergem no primeiro ajuste.
 *
 * **Não carrega valor em reais**, de propósito: o abatimento nasce do carrinho e
 * é derivado a cada leitura (ver `couponDiscountFor` no store). O que existe
 * aqui é a definição do panfleto.
 */
export interface FoundCoupon {
  couponId: number;
  code: string;
  description: string | null;
  /** Código do enum `CouponDiscountType`: 1 = percentual, 2 = valor fixo. */
  discountType: AppliedCoupon["discountType"];
  discountValue: number;
  /**
   * Usos restantes no instante da consulta. **`null` = ILIMITADO**, nunca "zero
   * usos": ler o nulo como esgotado recusaria justamente o cupom sem teto.
   *
   * Não é reserva nem promessa — nada foi travado no servidor.
   */
  remainingUses: number | null;
  /**
   * O limite conhecido já se esgotou e este resgate entraria por cima dele.
   *
   * Só a consulta offline responde isso, e **a venda segue mesmo assim**: limite
   * de cupom é orçamento de marketing, não estoque. O servidor carimba
   * `over_limit` quando a fila subir; aqui é aviso para o operador, não bloqueio.
   */
  overLimit: boolean;
  /** A resposta veio da base local, sem confirmação do servidor. */
  fromLocalDatabase: boolean;
  /** Questionário a apresentar. Vazio é o caso normal. */
  questions: CouponQuestion[];
}

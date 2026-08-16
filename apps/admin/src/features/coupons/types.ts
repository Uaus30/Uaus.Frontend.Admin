import type { CouponDiscountTypeCode, CouponDto, SaveCouponPayload } from "@workspace/api-client-react";

/**
 * Valores do formulário de cupom, exatamente como estão nos controles da tela.
 *
 * A vigência é guardada QUEBRADA em dia + hora de propósito. O `DatePicker` do
 * `packages/ui` trabalha só com data de calendário, mas `validFrom`/`validUntil`
 * são INSTANTES no backend — juntar os dois pedaços é responsabilidade desta
 * feature, e é o que permite o fim da vigência nascer às 23:59:59 do dia
 * escolhido em vez de à meia-noite (ver `composeInstant` no hook).
 */
export type CouponForm = {
  /** Código do panfleto. Normalizado para maiúsculas no envio. */
  code: string;
  /** Texto impresso no comprovante ao lado do código. Vazio = sem descrição. */
  description: string;
  discountType: CouponDiscountTypeCode;
  /** Percentual ou reais, cru do input (string vazia = não preenchido). */
  discountValue: string;
  /** Dia de início da vigência; a hora entra por `validFromTime`. */
  validFromDate: Date | undefined;
  /** Hora "HH:mm" do início da vigência. */
  validFromTime: string;
  /** Dia de fim da vigência. Indefinido = cupom sem prazo. */
  validUntilDate: Date | undefined;
  /** Hora "HH:mm" do fim da vigência. Nasce em 23:59 — ver o README. */
  validUntilTime: string;
  /**
   * Teto de resgates, cru. **Campo vazio significa ILIMITADO** e vira 0 no
   * payload; nunca `NaN`, que é o que `parseAmount` devolveria.
   */
  usageLimit: string;
  isActive: boolean;
  /** Id da campanha como string (valor do `Select`). Vazio = cupom sem perguntas. */
  campaignId: string;
};

/**
 * O que a tela precisa confirmar antes de disparar a mutação.
 *
 * É união discriminada, e não um callback guardado em estado, para que o teste
 * do hook consiga afirmar "a confirmação foi pedida, foi recusada, e nenhuma
 * mutação saiu" sem invocar nada do React DOM.
 */
export type CouponConfirm =
  /** Exclusão definitiva — só oferecida enquanto o cupom não tem resgate. */
  | { kind: "excluir"; coupon: CouponDto }
  /** Encerramento de um cupom já usado: ele para de valer e permanece no cadastro. */
  | { kind: "desativar"; coupon: CouponDto }
  /** Edição de definição (valor, tipo ou vigência) de um cupom já resgatado. */
  | { kind: "salvar"; coupon: CouponDto; payload: SaveCouponPayload };

/** Textos do diálogo de confirmação, derivados do pedido pelo hook. */
export interface CouponConfirmContent {
  title: string;
  /** Código do cupom, para o operador conferir que é a linha que ele acha que é. */
  itemName: string;
  description: string;
  confirmLabel: string;
  destructive: boolean;
}

export type { CouponDiscountTypeCode, CouponDto, SaveCouponPayload };

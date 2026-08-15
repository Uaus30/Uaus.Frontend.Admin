import { parseAmountOrNull } from "@workspace/core";

/**
 * Regras de abertura e fechamento do caixa.
 *
 * Ficam aqui, fora dos componentes, porque são decisões de negócio que precisam
 * de teste: a de fechamento chegou a existir só num JSDoc, sem implementação
 * nenhuma, e ninguém percebeu porque não havia nada que a exercitasse.
 */

/** Por que o caixa não pode ser fechado agora. */
export type CloseBlockReason =
  /** Não há sessão aberta — não há o que fechar. */
  | "sem-sessao"
  /** Existe venda ou baixa na fila offline que o servidor ainda não conhece. */
  | "fila-pendente";

export type CloseRegisterCheck = { allowed: true } | { allowed: false; reason: CloseBlockReason };

export interface CanCloseRegisterInput {
  /** Sessão de caixa aberta, ou `null`. */
  sessionId: number | null;
  /** Vendas + baixas de estoque esperando sincronização. */
  queuedCount: number;
}

/**
 * Decide se o caixa pode ser fechado.
 *
 * Movimento pendente bloqueia o fechamento — venda **ou** baixa de estoque —
 * por dois motivos distintos:
 *
 * 1. O esperado em gaveta é calculado pelo servidor a partir do que ele conhece.
 *    Fechar com venda na fila produz uma conferência que não fecha, e pior: o
 *    backend recusa depois a venda numa sessão já encerrada, então o dinheiro
 *    entrou na gaveta e a venda não existe em lugar nenhum.
 * 2. A baixa de estoque é carimbada com a sessão aberta no momento em que sobe.
 *    Subir depois do fechamento a joga no turno seguinte, sujando os dois.
 *
 * A tela deve tentar sincronizar antes de recusar — se a fila subir, o operador
 * segue direto para o fechamento.
 *
 * @param input Sessão corrente e tamanho da fila offline.
 */
export function canCloseRegister({ sessionId, queuedCount }: CanCloseRegisterInput): CloseRegisterCheck {
  if (sessionId == null) return { allowed: false, reason: "sem-sessao" };
  if (queuedCount > 0) return { allowed: false, reason: "fila-pendente" };
  return { allowed: true };
}

/** Valor de dinheiro aceito, ou o motivo da recusa. */
export type CashAmountResult = { value: number } | { error: "invalido" | "negativo" };

/**
 * Lê um campo de dinheiro do caixa (fundo de troco na abertura, contado no
 * fechamento).
 *
 * Campo vazio vale ZERO, e isso é intencional: abrir o caixa sem fundo de troco
 * é uma operação legítima, e obrigar o operador a digitar "0" só atrasaria o
 * balcão. O que não é aceito é texto ilegível ou valor negativo.
 *
 * Existe porque os dois diálogos de caixa chamavam `parseAmount` direto num
 * campo opcional — e `parseAmount("")` devolve `NaN`, que ia para a API.
 *
 * @param text Valor como o operador digitou.
 */
export function parseCashAmount(text: string): CashAmountResult {
  const parsed = parseAmountOrNull(text);

  if (parsed === null) return { error: "invalido" };
  if (parsed < 0) return { error: "negativo" };

  return { value: parsed };
}

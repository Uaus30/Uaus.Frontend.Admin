import type {
  CashRegisterSessionDto,
  CashRegisterSessionSummaryDto,
} from "@workspace/api-client-react";

/**
 * Valores do Select de status da listagem.
 *
 * A UI trabalha com estas chaves legíveis; a conversão para o código numérico
 * da API (`CASH_REGISTER_SESSION_OPEN`/`CASH_REGISTER_SESSION_CLOSED`) fica em
 * `statusFilterToCode`, no hook controlador.
 */
export type CashRegisterSessionStatusFilter = "all" | "open" | "closed";

export type { CashRegisterSessionDto, CashRegisterSessionSummaryDto };

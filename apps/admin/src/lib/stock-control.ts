import type { StockControlDisabledReason, StockForecastStatus } from "@workspace/api-client-react";

/**
 * Vocabulário do controle de estoque (29/09/2026), usado pelo relatório de
 * estoque baixo, pelo cadastro do produto e pela compra de reposição.
 *
 * Mora em `lib/` porque três features falam dele, e `features/a` não importa de
 * `features/b`. A REGRA (quem entra no relatório) é do backend
 * (`StockControlRules`); aqui só nome, texto e o palpite da compra.
 */

/** Estoque mínimo padrão de fábrica — o mesmo do backend e do DEFAULT da coluna. */
export const STANDARD_DEFAULT_MIN_STOCK = 2;

/** Onde se muda o estoque mínimo padrão: a seção Estoque das Configurações. */
export const STOCK_SETTINGS_PATH = "/configuracoes#estoque";

/** Id do cartão Estoque nas Configurações — o alvo do link acima. */
export const STOCK_SETTINGS_ANCHOR = "estoque";

/** Os motivos de desligar o controle, na ordem do seletor, com o que cada um faz. */
export const STOCK_CONTROL_DISABLED_REASONS: ReadonlyArray<{
  value: StockControlDisabledReason;
  label: string;
  hint: string;
}> = [
  {
    value: "EndOfLine",
    label: "Fim de linha",
    hint: "Sem fornecedor para repor. Se entrar mercadoria dele, o controle volta sozinho.",
  },
  { value: "InternalUse", label: "Brinde ou uso interno", hint: "Não é para vender nem repor." },
  { value: "Seasonal", label: "Sazonal", hint: "Só se compra na temporada." },
  { value: "Other", label: "Outro", hint: "Religue quando quiser voltar a acompanhar." },
];

/** Rótulo do motivo; vazio sem motivo. */
export function stockControlReasonLabel(reason: StockControlDisabledReason | null | undefined): string {
  return STOCK_CONTROL_DISABLED_REASONS.find((item) => item.value === reason)?.label ?? "";
}

/** Rótulo da classificação da rotina diária. */
export function forecastStatusLabel(status: StockForecastStatus | null | undefined): string {
  switch (status) {
    case "Controlled":
      return "Controlado";
    case "LowTurnover":
      return "Giro baixo";
    case "New":
      return "Novo";
    default:
      return "";
  }
}

/**
 * Por que o produto está fora do controle, em uma frase curta: o motivo de quem
 * desligou, ou o giro baixo que a rotina detectou.
 */
export function outOfControlLabel(item: {
  stockControlEnabled?: boolean;
  stockControlDisabledReason?: StockControlDisabledReason | null;
  forecastStatus?: StockForecastStatus | null;
}): string {
  if (item.stockControlEnabled === false) {
    const motivo = stockControlReasonLabel(item.stockControlDisabledReason);
    return motivo ? `Desligado · ${motivo}` : "Desligado";
  }
  return item.forecastStatus === "LowTurnover" ? "Giro baixo" : "";
}

/** Quantos dias de demanda a compra de reposição sugere cobrir. */
export const RESTOCK_COVER_DAYS = 60;

/**
 * A quantidade que a compra de reposição sugere — palpite, não regra: quem
 * compra ajusta.
 *
 * O maior entre dois números: o que cobre {@link RESTOCK_COVER_DAYS} dias da
 * demanda prevista, e o que recompõe o mínimo próprio. Nunca menos de 1. Até
 * 29/09/2026 era só `minStock - stock`, e com o mínimo quase nunca preenchido a
 * compra nascia com 1 unidade.
 */
export function suggestedRestockQuantity(product: {
  stock?: number | null;
  minStock?: number | null;
  dailyDemand?: number | null;
}): number {
  const saldo = product.stock ?? 0;
  const pelaDemanda = Math.ceil((product.dailyDemand ?? 0) * RESTOCK_COVER_DAYS) - saldo;
  const peloMinimo = (product.minStock ?? 0) - saldo;
  return Math.max(1, pelaDemanda, peloMinimo);
}

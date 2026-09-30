import type { StockControlDisabledReason } from "@workspace/api-client-react";

/**
 * A escolha feita no interruptor "Controlar estoque" desta tela (29/09/2026).
 *
 * Fica à parte do produto de propósito: o salvar só manda o controle quando a
 * pessoa mexeu nele AQUI. O relatório de estoque baixo desliga o controle de uma
 * variação só, e mandar de volta o que a tela carregou desfaria essa decisão em
 * silêncio — a mesma armadilha do "Exibir no site" (23/09/2026).
 */
export type StockControlChoice = {
  enabled: boolean;
  reason: StockControlDisabledReason | null;
};

/** O que a tela mostra: ligado, desligado, ou misto entre as variações. */
export type StockControlView = {
  state: "on" | "off" | "mixed";
  reason: StockControlDisabledReason | null;
  /** Quantas variações estão desligadas, para o texto do estado misto. */
  disabledCount: number;
  total: number;
};

type ComControle = {
  stockControlEnabled?: boolean;
  stockControlDisabledReason?: StockControlDisabledReason | null;
};

/**
 * O estado do interruptor: a escolha desta tela, se houver; senão, o que os
 * produtos carregados têm. Campo ausente (backend anterior ao controle) vale
 * ligado, que é o padrão de todo produto.
 */
export function viewStockControl(
  choice: StockControlChoice | null | undefined,
  products: ComControle[],
): StockControlView {
  const total = products.length;

  if (choice) {
    return {
      state: choice.enabled ? "on" : "off",
      reason: choice.enabled ? null : choice.reason,
      disabledCount: choice.enabled ? 0 : total,
      total,
    };
  }

  const desligados = products.filter((product) => product.stockControlEnabled === false);
  const state = desligados.length === 0 ? "on" : desligados.length === total ? "off" : "mixed";

  return {
    state,
    reason: state === "off" ? (desligados[0]?.stockControlDisabledReason ?? null) : null,
    disabledCount: desligados.length,
    total,
  };
}

/**
 * Os campos do controle no payload de CADA produto salvo: vazio quando a pessoa
 * não mexeu no interruptor — o servidor mantém o que está gravado.
 */
export function stockControlPayload(choice: StockControlChoice | null | undefined): {
  stockControlEnabled?: boolean;
  stockControlDisabledReason?: StockControlDisabledReason | null;
} {
  if (!choice) return {};
  return {
    stockControlEnabled: choice.enabled,
    stockControlDisabledReason: choice.enabled ? null : choice.reason,
  };
}

/** O produto da tela depois de salvar a escolha: o que o servidor passou a ter. */
export function applyStockControlChoice<T extends ComControle>(product: T, choice: StockControlChoice): T {
  return {
    ...product,
    stockControlEnabled: choice.enabled,
    stockControlDisabledReason: choice.enabled ? null : choice.reason,
  };
}

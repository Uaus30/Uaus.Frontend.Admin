import { formatCurrency } from "@workspace/core";

/**
 * Os fechamentos da conta antiga (`calculationVersion` 1, de março a
 * outubro/2026) não são recalculados: baixas fora do lucro e só o desconto da
 * venda. A tela mostra "—" nos campos que eles não tinham, em vez do zero que
 * a API devolve — zero pareceria dado.
 *
 * Sem versão (resposta de uma API anterior à conta nova) também é antigo.
 */
export function isLegacyClosing(closing: { calculationVersion?: number | null }): boolean {
  return (closing.calculationVersion ?? 1) < 2;
}

/** O aviso que acompanha um fechamento da conta antiga. */
export const LEGACY_CLOSING_NOTE =
  "Fechado com a conta antiga: baixas fora do lucro e só o desconto da venda.";

/** Valor de campo que só existe na conta nova: "—" no fechamento antigo ou quando falta. */
export function newFieldText(legacy: boolean, value: number | null | undefined): string {
  return legacy || value == null ? "—" : formatCurrency(value);
}

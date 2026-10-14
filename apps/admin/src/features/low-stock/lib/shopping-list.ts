import { normalizeSearchText } from "@workspace/core";
import type { SupplierDto } from "@workspace/api-client-react";
import { compareNames } from "@/lib/select-options";
import type { LowStockItem } from "../types";

/**
 * Regras de exibição da Lista de Compras (14/10/2026), puras para o teste
 * alcançar sem montar tela.
 */

/** Uma cidade do seletor: a chave sem acento e sem caixa, e o nome mostrado. */
export type CityOption = { value: string; label: string };

/** Tem acento ou cedilha — a grafia que carrega mais informação. */
function hasDiacritics(text: string): boolean {
  return text.normalize("NFD") !== text;
}

/**
 * As cidades cadastradas nos fornecedores, uma vez cada.
 *
 * Deduplicadas sem caixa, sem acento e sem espaço sobrando: "Maringa",
 * "MARINGÁ" e " Maringá " são a mesma viagem, e três opções para ela fariam a
 * pessoa escolher uma e perder os produtos das outras duas — mesmo com o
 * backend comparando sem acento, a lista pareceria ter cidades diferentes.
 *
 * O nome mostrado é a grafia mais usada; no empate, a acentuada ("Maringá"
 * ganha de "Maringa"), e depois a primeira no alfabeto. A ordem é alfabética,
 * como todo select do admin.
 */
export function supplierCityOptions(suppliers: ReadonlyArray<Pick<SupplierDto, "city">>): CityOption[] {
  const groups = new Map<string, Map<string, number>>();

  for (const supplier of suppliers) {
    const label = (supplier.city ?? "").replace(/\s+/g, " ").trim();
    const key = normalizeSearchText(label);
    if (!key) continue;

    const spellings = groups.get(key) ?? new Map<string, number>();
    spellings.set(label, (spellings.get(label) ?? 0) + 1);
    groups.set(key, spellings);
  }

  const options: CityOption[] = [];
  for (const [value, spellings] of groups) {
    const [label] = [...spellings.entries()].sort(
      ([left, leftCount], [right, rightCount]) =>
        rightCount - leftCount ||
        Number(hasDiacritics(right)) - Number(hasDiacritics(left)) ||
        compareNames(left, right),
    )[0];
    options.push({ value, label });
  }

  return options.sort((left, right) => compareNames(left.label, right.label));
}

/**
 * "25/09/26", direto do texto da API (`2026-09-25T00:00:00`), sem passar por
 * `new Date`: a data vem sem fuso, e lê-la no fuso do aparelho é a armadilha 8
 * do repositório. Com o ano: sem ele, a compra de um ano atrás pareceria a da
 * semana passada — e é por ela que se decide a viagem (revisão de 14/10/2026).
 * Formato inesperado volta como veio.
 */
export function shortDate(date: string): string {
  const match = /^\d{2}(\d{2})-(\d{2})-(\d{2})/.exec(date);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : date;
}

/**
 * A coluna "Última compra": "3 un. em 25/09/26". É o número que explica por que um
 * produto de atacado ficou fora do controle — comprou-se pouco, para testar a
 * saída. Sem compra registrada, "—".
 */
export function lastPurchaseLabel(
  item: Pick<LowStockItem, "lastPurchaseQuantity" | "lastPurchaseDate">,
): string {
  if (item.lastPurchaseQuantity == null) return "—";
  const quantidade = `${item.lastPurchaseQuantity} un.`;
  return item.lastPurchaseDate ? `${quantidade} em ${shortDate(item.lastPurchaseDate)}` : quantidade;
}

/**
 * O produto está fora do controle de estoque com o motivo "Planejar viagem" —
 * a linha ganha o selo, porque é o que separa "acabou e o relatório avisou" de
 * "acabou e só esta lista sabe".
 */
export function isPlanTrip(
  item: Pick<LowStockItem, "stockControlEnabled" | "stockControlDisabledReason">,
): boolean {
  return item.stockControlEnabled === false && item.stockControlDisabledReason === "PlanTrip";
}

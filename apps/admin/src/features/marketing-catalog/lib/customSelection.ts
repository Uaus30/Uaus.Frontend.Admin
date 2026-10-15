import {
  CATALOG_UNAVAILABLE_REASON,
  enumCode,
  type CatalogSelectionDto,
  type EnumValue,
  type StorefrontProductDto,
} from "@workspace/api-client-react";
import { formatCurrency } from "@workspace/core";
import type { CatalogFormat, CatalogProduct } from "../types";
import { toCatalogProduct } from "./catalogProducts";

/** Um produto escolhido à mão para a peça personalizada. */
export interface CustomItem {
  productGroupId: number;
  /** O nome do cadastro quando entrou na lista — o placeholder do campo. */
  catalogName: string;
  /**
   * O nome que sai impresso, quando a pessoa mexeu (como na etiqueta de
   * gôndola). Vazio = o nome do cadastro NA HORA de gerar.
   */
  printedName: string;
  /** A capa, para a miniatura (o caminho como a API manda). */
  imageUrl?: string;
}

/** Até quantos caracteres o nome impresso pode ter: o card mostra duas linhas, e o resto vira reticências. */
export const PRINTED_NAME_MAX_LENGTH = 60;

/** Código de `CATALOG_UNAVAILABLE_REASON`. */
export type UnavailableCode = number;

/** Como o motivo aparece na tela, em minúsculas para caber no meio da frase. */
export function unavailableLabel(reason: EnumValue | UnavailableCode): string {
  switch (enumCode(reason, CATALOG_UNAVAILABLE_REASON)) {
    case CATALOG_UNAVAILABLE_REASON.NotOnSite:
      return "fora do site";
    case CATALOG_UNAVAILABLE_REASON.OutOfStock:
      return "sem saldo";
    case CATALOG_UNAVAILABLE_REASON.NoPhoto:
      return "sem foto";
    default:
      return "indisponível";
  }
}

/** O nome do campo pronto para o card: sem espaço sobrando. Vazio = vale o do cadastro. */
export function normalizePrintedName(name: string): string {
  return name.replace(/\s+/g, " ").trim().slice(0, PRINTED_NAME_MAX_LENGTH).trim();
}

/** O que a resposta da seleção vira: os produtos do molde e quem não pode entrar. */
export interface CustomProducts {
  products: CatalogProduct[];
  /** Quem não pode entrar, por id, com o código do motivo. */
  unavailable: Record<number, UnavailableCode>;
}

/**
 * A resposta da seleção no formato do molde, NA ORDEM da lista e com o nome
 * impresso que a pessoa escreveu.
 *
 * Quem o servidor recusou, e quem voltou sem foto (`toCatalogProduct` descarta),
 * vai para `unavailable` — a peça não pode sair com um produto a menos sem a
 * pessoa saber.
 */
export function toCustomProducts(
  response: CatalogSelectionDto,
  items: readonly CustomItem[],
): CustomProducts {
  const unavailable: Record<number, UnavailableCode> = {};
  for (const entry of response.unavailable) {
    unavailable[entry.productGroupId] = enumCode(entry.reason, CATALOG_UNAVAILABLE_REASON);
  }

  const byId = new Map(response.items.map((entry) => [entry.product.productGroupId, entry]));
  const products: CatalogProduct[] = [];

  for (const item of items) {
    if (unavailable[item.productGroupId] !== undefined) continue;

    const entry = byId.get(item.productGroupId);
    const product = entry ? toCatalogProduct(entry) : null;
    if (!product) {
      unavailable[item.productGroupId] = entry
        ? CATALOG_UNAVAILABLE_REASON.NoPhoto
        : CATALOG_UNAVAILABLE_REASON.NotOnSite;
      continue;
    }

    const printed = normalizePrintedName(item.printedName);
    products.push(printed ? { ...product, name: printed } : product);
  }

  return { products, unavailable };
}

/**
 * O preço do resultado da busca, como vai sair no card: "R$ 12,00",
 * "a partir de R$ 8,00", com "Promoção" ou o combo ao lado. É o preço de AGORA,
 * para a pessoa decidir; o impresso é consultado de novo ao gerar.
 */
export function describeCardPrice(card: StorefrontProductDto): string {
  // O papel não importa aqui: só o preço e o selo de promoção.
  const product = toCatalogProduct({ role: "Regular", product: { ...card, imageUrl: card.imageUrl || "-" } });
  if (!product) return "";

  const price = `${product.hasPriceRange ? "a partir de " : ""}${formatCurrency(product.price)}`;
  if (product.comboOffer) return `${price} · ${product.comboOffer}`;
  return product.badge === "offer" ? `${price} · Promoção` : price;
}

/** "Brinquedo X (sem saldo) e Copo Y (fora do site)" — a lista do aviso. */
export function describeUnavailable(
  unavailable: Readonly<Record<number, UnavailableCode>>,
  items: readonly CustomItem[],
): string {
  const parts = items
    .filter((item) => unavailable[item.productGroupId] !== undefined)
    .map(
      (item) =>
        `${normalizePrintedName(item.printedName) || item.catalogName} (${unavailableLabel(unavailable[item.productGroupId])})`,
    );

  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} e ${parts.at(-1)}`;
}

/** Move o item de `index` uma posição para cima (-1) ou para baixo (+1). Fora da lista, nada muda. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];

  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// ------------------------------------------------------- guardado no aparelho

/**
 * A lista fica no APARELHO (decisão do dono, 15/10/2026): o banner é montado e
 * compartilhado no mesmo celular. Depois de compartilhado, quem guarda a peça é
 * o histórico, no servidor.
 */
export const CUSTOM_STORAGE_KEY = "uaus:catalogo-personalizado:v1";

export interface StoredCustomCatalog {
  format: CatalogFormat;
  title: string;
  items: CustomItem[];
}

function isCustomItem(value: unknown): value is CustomItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.productGroupId === "number" &&
    item.productGroupId > 0 &&
    typeof item.catalogName === "string" &&
    typeof item.printedName === "string" &&
    (item.imageUrl === undefined || typeof item.imageUrl === "string")
  );
}

/**
 * Lê a lista guardada. Qualquer coisa estranha — armazenamento bloqueado (aba
 * anônima), JSON quebrado, versão antiga — vira lista vazia: a tela não pode
 * deixar de abrir por causa de um rascunho.
 */
export function loadStoredCustom(storage: Pick<Storage, "getItem"> | undefined): StoredCustomCatalog | null {
  try {
    const raw = storage?.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const format = parsed.format === "feed" ? "feed" : "story";
    const title = typeof parsed.title === "string" ? parsed.title : "";
    const seen = new Set<number>();
    const items = (Array.isArray(parsed.items) ? parsed.items : []).filter(
      (item): item is CustomItem =>
        isCustomItem(item) && !seen.has(item.productGroupId) && Boolean(seen.add(item.productGroupId)),
    );

    return { format, title, items };
  } catch {
    return null;
  }
}

/** Guarda a lista. Falhar aqui (cota, aba anônima) só faz a lista não sobreviver ao recarregar. */
export function saveStoredCustom(
  storage: Pick<Storage, "setItem"> | undefined,
  value: StoredCustomCatalog,
): void {
  try {
    storage?.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Sem armazenamento a lista vale enquanto a tela estiver aberta.
  }
}

/** O `localStorage`, quando o navegador deixa ler (a aba anônima de alguns navegadores lança). */
export function browserStorage(): Storage | undefined {
  try {
    return typeof window !== "undefined" ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

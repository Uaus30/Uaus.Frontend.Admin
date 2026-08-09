import { STORE, openLocalDatabase } from "./database";
import { getAll, getByKey } from "./idb";
import type { LocalCustomer, LocalPaymentMethod, LocalProduct } from "./types";

/**
 * Leitura do cadastro na base local. É o que a tela consulta quando a API está
 * fora do ar.
 *
 * A busca é feita em memória sobre a store inteira, sem índices. É deliberado: o
 * catálogo de uma loja cabe folgado na memória do caixa, e varrer um array é
 * mais rápido e muito mais simples do que manter índices de IndexedDB para busca
 * parcial — que o IndexedDB não faz nativamente de todo modo.
 */

/** Quantos resultados a busca devolve, alinhado com o `size` da busca online. */
const SEARCH_LIMIT = 20;

/** Marcas de acento que a normalização NFD separa das letras. */
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Normaliza o texto para a busca local: minúsculas e sem acento.
 *
 * O operador digita "cafe" e espera achar "Café". Fazer isso na leitura custaria
 * uma normalização por produto a cada tecla; a instalação do snapshot grava o
 * texto já normalizado, uma vez, na carga.
 */
export function normalizeForSearch(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(DIACRITICS, "");
}

/** Todos os produtos da base local. */
export function listLocalProducts(): Promise<LocalProduct[]> {
  return openLocalDatabase().then((db) => getAll<LocalProduct>(db, STORE.products));
}

/** Um produto da base local pelo ID, ou `null`. */
export function getLocalProduct(productId: number): Promise<LocalProduct | null> {
  return openLocalDatabase().then((db) => getByKey<LocalProduct>(db, STORE.products, productId));
}

/**
 * Filtra e ordena produtos por um termo de busca.
 *
 * Separada da leitura do banco de propósito — é a regra de relevância, e assim
 * pode ser testada sem IndexedDB.
 *
 * Ordem de prioridade:
 * 1. código de barras exato (é o leitor bipando)
 * 2. nome que começa com o termo
 * 3. nome que contém o termo
 * 4. código de barras que contém o termo
 *
 * @param products Catálogo local.
 * @param term Termo digitado, ainda não normalizado.
 * @param limit Máximo de resultados.
 */
export function filterProducts(
  products: LocalProduct[],
  term: string,
  limit = SEARCH_LIMIT,
): LocalProduct[] {
  const raw = term.trim();
  if (!raw) return [];

  const needle = normalizeForSearch(raw);
  const cleanTermDigits = raw.replace(/\D/g, "");

  const scored: Array<{ product: LocalProduct; rank: number }> = [];

  for (const product of products) {
    const pBarcode = (product.barcode ?? "").trim();
    const pBarcodeDigits = pBarcode.replace(/\D/g, "");
    let rank: number;

    if (pBarcode === raw || (cleanTermDigits.length >= 4 && pBarcodeDigits === cleanTermDigits)) rank = 0;
    else if (product.searchName.startsWith(needle)) rank = 1;
    else if (product.searchName.includes(needle)) rank = 2;
    else if (pBarcode && pBarcode.includes(raw)) rank = 3;
    else continue;

    scored.push({ product, rank });
  }

  return scored
    .sort((a, b) => a.rank - b.rank || a.product.name.localeCompare(b.product.name, "pt-BR"))
    .slice(0, limit)
    .map((entry) => entry.product);
}

/**
 * Busca produtos na base local por nome ou código de barras.
 *
 * @param term Termo digitado pelo operador.
 * @param limit Máximo de resultados.
 */
export async function searchLocalProducts(term: string, limit = SEARCH_LIMIT): Promise<LocalProduct[]> {
  return filterProducts(await listLocalProducts(), term, limit);
}

/** Formas de pagamento da base local, com os parcelamentos. */
export function listLocalPaymentMethods(): Promise<LocalPaymentMethod[]> {
  return openLocalDatabase().then((db) => getAll<LocalPaymentMethod>(db, STORE.paymentMethods));
}

/**
 * Filtra clientes por nome ou documento. Pura, para poder ser testada.
 *
 * @param customers Clientes da base local.
 * @param term Termo digitado, ainda não normalizado.
 * @param limit Máximo de resultados.
 */
export function filterCustomers(
  customers: LocalCustomer[],
  term: string,
  limit = 8,
): LocalCustomer[] {
  const raw = term.trim();
  if (!raw) return [];

  const needle = normalizeForSearch(raw);
  // O documento é comparado só por dígitos: o operador digita com ou sem pontuação.
  const digits = raw.replace(/\D/g, "");

  return customers
    .filter(
      (customer) =>
        customer.searchName.includes(needle) ||
        (digits.length > 0 && (customer.document ?? "").replace(/\D/g, "").includes(digits)),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, limit);
}

/** Busca clientes na base local por nome ou documento. */
export async function searchLocalCustomers(term: string, limit = 8): Promise<LocalCustomer[]> {
  const db = await openLocalDatabase();
  return filterCustomers(await getAll<LocalCustomer>(db, STORE.customers), term, limit);
}

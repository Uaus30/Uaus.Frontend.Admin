import { normalizeSearchText, tokenizeSearchTerms } from "@workspace/core";
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

/**
 * Normaliza o texto para a busca local: minúsculas, sem acento e sem espaço
 * sobrando.
 *
 * O operador digita "cafe" e espera achar "Café". Fazer isso na leitura custaria
 * uma normalização por produto a cada tecla; a instalação do snapshot grava o
 * texto já normalizado, uma vez, na carga.
 *
 * Delega para o `@workspace/core`, que é onde a regra mora: `tokenizeSearchTerms`
 * usa a MESMA normalização, e uma segunda implementação aqui já divergiria na
 * primeira mudança — foi assim que o `round2` chegou a ter três algoritmos. O
 * nome local sobrevive porque `snapshot.ts` e os testes o usam.
 */
export function normalizeForSearch(value: string): string {
  return normalizeSearchText(value);
}

let _cachedProducts: LocalProduct[] | null = null;

export function invalidateProductsCache() {
  _cachedProducts = null;
}

/** Todos os produtos da base local (com cache em memória para não gargalar a busca). */
export function listLocalProducts(): Promise<LocalProduct[]> {
  if (_cachedProducts) return Promise.resolve(_cachedProducts);
  return openLocalDatabase()
    .then((db) => getAll<LocalProduct>(db, STORE.products))
    .then((products) => {
      _cachedProducts = products;
      return products;
    });
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
 * **Mesma regra da busca online** (`ProductSearchFilter` no backend): o termo é
 * quebrado em palavras e o produto casa quando TODAS aparecem nele, em qualquer
 * posição e em qualquer ordem. É o que faz "bacia com tampa" — e "tampa bacia" —
 * encontrarem "BACIA PLÁSTICA 2L C/ TAMPA".
 *
 * Antes daqui as duas buscas divergiam: online o operador achava, offline não,
 * e nada na tela explicava por quê. A regra completa está em
 * `Uaus.Backend.Api/docs/busca-de-produtos.md`.
 *
 * Cada palavra é procurada no nome normalizado OU no código de barras. O nome
 * local já traz a variação entre colchetes ("CHICLETE BUBBALOO [uva]"), porque o
 * snapshot compõe o nome antes de gravar — então procurar "uva" funciona aqui
 * como funciona no servidor. A descrição do produto, que o servidor também
 * indexa, não vem no snapshot; hoje nenhum produto do catálogo tem uma.
 *
 * Ordem de relevância, espelhando os degraus do backend:
 * 1. código de barras exato (é o leitor bipando)
 * 2. nome que começa com o termo inteiro
 * 3. nome que contém o termo inteiro
 * 4. nome que começa com a primeira palavra do termo
 * 5. o resto que casou
 *
 * @param products Catálogo local.
 * @param term Termo digitado, ainda não normalizado.
 * @param limit Máximo de resultados.
 */
export function filterProducts(products: LocalProduct[], term: string, limit = SEARCH_LIMIT): LocalProduct[] {
  const raw = term.trim();
  if (!raw) return [];

  const tokens = tokenizeSearchTerms(raw);
  if (tokens.length === 0) return [];

  const frase = normalizeForSearch(raw);
  const primeira = tokens[0];
  const digitosDoTermo = raw.replace(/\D/g, "");

  const scored: Array<{ product: LocalProduct; rank: number }> = [];

  for (const product of products) {
    const barcode = (product.barcode ?? "").trim();
    const barcodeDigits = barcode.replace(/\D/g, "");

    // Os tokens vêm em minúsculas; o servidor guarda o código de barras dentro
    // do `search_text` já normalizado, e comparar cru aqui erraria num cadastro
    // com letra (código interno, referência de fornecedor).
    const barcodeBusca = barcode.toLowerCase();

    // Todas as palavras precisam aparecer — no nome ou no código de barras.
    const casaTudo = tokens.every(
      (token) => product.searchName.includes(token) || barcodeBusca.includes(token),
    );
    if (!casaTudo) continue;

    const barcodeExato = barcode === raw || (digitosDoTermo.length >= 4 && barcodeDigits === digitosDoTermo);

    let rank: number;
    if (barcodeExato) rank = 0;
    else if (product.searchName.startsWith(frase)) rank = 1;
    else if (product.searchName.includes(frase)) rank = 2;
    else if (product.searchName.startsWith(primeira)) rank = 3;
    else rank = 4;

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
export function filterCustomers(customers: LocalCustomer[], term: string, limit = 8): LocalCustomer[] {
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

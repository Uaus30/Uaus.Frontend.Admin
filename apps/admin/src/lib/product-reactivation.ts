import { useSyncExternalStore } from "react";
import {
  PRODUCT_STATUS,
  enumCode,
  type ProductDto,
  type ReactivatedProductDto,
} from "@workspace/api-client-react";

/**
 * Aviso de produto REATIVADO por entrada de estoque (decisão do dono, 23/09/2026).
 *
 * Entrada em produto Inativo ou "Sem estoque" o devolve a Ativo no servidor, e a
 * resposta diz quem voltou. Três telas lançam entrada — a aba Estoque do
 * produto, o recebimento de compra e a contagem física — e o recebimento de
 * compra NAVEGA logo depois de gravar: um estado da própria tela morreria com
 * ela antes de o operador ler o aviso. Por isso o aviso mora fora da árvore das
 * telas, num store de módulo, e a modal fica montada na casca do App.
 *
 * Tem duas escutas:
 * - a modal (`useReactivatedProducts`), que mostra o aviso até alguém fechar;
 * - o editor de produto aberto (`subscribeToReactivations`), que carregou o
 *   status na abertura e, sem ouvir, gravaria o status velho no próximo Salvar.
 */

type SnapshotListener = () => void;
type ReactivationListener = (products: ReactivatedProductDto[]) => void;

let pending: ReactivatedProductDto[] = [];
const snapshotListeners = new Set<SnapshotListener>();
const reactivationListeners = new Set<ReactivationListener>();

function notifySnapshot() {
  snapshotListeners.forEach((listener) => listener());
}

/**
 * Anuncia o que uma entrada reativou. Ausente ou vazio não faz nada — é o caso
 * comum, e a API omite o campo quando ninguém voltou.
 *
 * Soma ao aviso que ainda está aberto em vez de trocá-lo: duas entradas em
 * sequência antes de o operador fechar a modal não podem esconder a primeira.
 */
export function announceReactivatedProducts(products: ReactivatedProductDto[] | null | undefined): void {
  if (!products || products.length === 0) return;

  const fresh = products.filter((product) => !pending.some((item) => item.productId === product.productId));
  if (fresh.length > 0) {
    pending = [...pending, ...fresh];
    notifySnapshot();
  }

  reactivationListeners.forEach((listener) => listener(products));
}

/** Fecha o aviso. */
export function dismissReactivatedProducts(): void {
  if (pending.length === 0) return;
  pending = [];
  notifySnapshot();
}

function subscribeSnapshot(listener: SnapshotListener) {
  snapshotListeners.add(listener);
  return () => {
    snapshotListeners.delete(listener);
  };
}

function getSnapshot() {
  return pending;
}

/** Os produtos do aviso aberto; lista vazia quando não há aviso. */
export function useReactivatedProducts(): ReactivatedProductDto[] {
  return useSyncExternalStore(subscribeSnapshot, getSnapshot, getSnapshot);
}

/**
 * Escuta cada reativação no momento em que ela é anunciada — inclusive a de um
 * produto que já estava no aviso aberto. Devolve a função que cancela a escuta.
 */
export function subscribeToReactivations(listener: ReactivationListener): () => void {
  reactivationListeners.add(listener);
  return () => {
    reactivationListeners.delete(listener);
  };
}

/** O pedaço do produto que a comparação lê — o que `product-for-entry` guarda. */
type ProductStatusSnapshot = Pick<ProductDto, "id" | "status" | "displayName" | "name">;

/**
 * A reativação vista pela DIFERENÇA entre o produto antes e depois da entrada.
 *
 * É a rede de segurança do retry. A resposta se perde na rede depois de o
 * servidor gravar, a pessoa clica de novo com a mesma chave de idempotência, e o
 * servidor devolve a nota já gravada — sem a lista, porque nada foi reativado
 * nesta segunda chamada. Sem o aviso, o editor de produto aberto continuaria
 * com o status velho, e o Salvar seguinte desfaria a reativação em silêncio.
 *
 * Quem lança a entrada lê o produto do cache antes de gravar e depois de
 * recarregar, e usa esta função quando a resposta não traz a lista.
 */
export function reactivationBetween(
  before: ProductStatusSnapshot | undefined,
  after: ProductStatusSnapshot | undefined,
): ReactivatedProductDto[] {
  if (!before || !after || before.id !== after.id) return [];
  if (enumCode(after.status, PRODUCT_STATUS) !== PRODUCT_STATUS.Active) return [];

  const previous = enumCode(before.status, PRODUCT_STATUS);
  if (previous !== PRODUCT_STATUS.Inactive && previous !== PRODUCT_STATUS.OutOfStock) return [];

  return [
    {
      productId: after.id,
      productName: after.displayName || after.name,
      previousStatus: previous === PRODUCT_STATUS.Inactive ? "Inactive" : "OutOfStock",
    },
  ];
}

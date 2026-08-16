/**
 * Regras da lista de itens do diálogo de baixa de estoque.
 *
 * Funções puras, sem React e sem IndexedDB: a lista é só um array, e as decisões
 * que valem a pena testar — o que acontece ao bipar o mesmo produto duas vezes,
 * quando a quantidade não cabe no saldo — não precisam de tela para serem
 * verificadas.
 */

/** O que a lista precisa saber de um produto para recebê-lo. */
export interface WriteOffProduct {
  id: number;
  name: string;
  barcode: string;
  /** Saldo conhecido no momento da busca (do servidor, ou da base local offline). */
  stock: number;
}

/** Um item da baixa em edição. */
export interface WriteOffDraftItem {
  productId: number;
  name: string;
  barcode: string;
  quantity: number;
  /**
   * Saldo conhecido quando o produto entrou na lista.
   *
   * Guardado no item, e não relido a cada tecla, para que a conferência não
   * dependa de uma consulta por dígito digitado — e para que a lista continue
   * conferível offline, onde não há a quem perguntar.
   */
  availableStock: number;
}

/**
 * Acrescenta o produto à lista, ou soma uma unidade se ele já estiver lá.
 *
 * Somar em vez de duplicar não é só conveniência: o backend recusa a baixa com o
 * mesmo produto em dois itens (`RegisterStockWriteOffRequest.EnsureIsValid`).
 *
 * @param items Lista atual.
 * @param product Produto escolhido na busca.
 * @returns Uma lista nova; a original não é alterada.
 */
export function addDraftItem(items: WriteOffDraftItem[], product: WriteOffProduct): WriteOffDraftItem[] {
  const existing = items.find((item) => item.productId === product.id);

  if (existing) {
    return items.map((item) =>
      item.productId === product.id
        ? // O saldo é reatualizado junto: a busca que trouxe o produto de novo
          // pode ter vindo do servidor com um número mais recente.
          { ...item, quantity: item.quantity + 1, availableStock: product.stock }
        : item,
    );
  }

  return [
    ...items,
    {
      productId: product.id,
      name: product.name,
      barcode: product.barcode,
      quantity: 1,
      availableStock: product.stock,
    },
  ];
}

/**
 * Troca a quantidade de um item.
 *
 * O piso é 1: zero seria um item que não baixa nada, e o backend recusaria a
 * baixa inteira por causa dele. Quem quer tirar o produto da lista remove o item.
 *
 * @param quantity Quantidade digitada, possivelmente inválida.
 */
export function setDraftQuantity(
  items: WriteOffDraftItem[],
  productId: number,
  quantity: number,
): WriteOffDraftItem[] {
  const safe = Number.isFinite(quantity) ? Math.floor(quantity) : 1;

  return items.map((item) =>
    item.productId === productId ? { ...item, quantity: Math.max(1, safe) } : item,
  );
}

/** Tira o produto da lista. */
export function removeDraftItem(items: WriteOffDraftItem[], productId: number): WriteOffDraftItem[] {
  return items.filter((item) => item.productId !== productId);
}

/**
 * Itens cuja quantidade não cabe no saldo conhecido.
 *
 * A conferência acontece **antes** de confirmar porque o backend recusa baixa
 * acima do saldo, e offline a recusa só apareceria na sincronização — horas
 * depois, quando ninguém mais lembra o que foi jogado fora.
 */
export function findDraftShortages(items: WriteOffDraftItem[]): WriteOffDraftItem[] {
  return items.filter((item) => item.quantity > item.availableStock);
}

/** Soma das quantidades da lista. */
export function totalDraftQuantity(items: WriteOffDraftItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Converte a lista no formato que o registro da baixa espera.
 *
 * O nome do produto vai junto para a fila offline: a lista de pendências precisa
 * dele, e a base local pode ter mudado quando a baixa subir.
 */
export function toWriteOffItems(items: WriteOffDraftItem[]) {
  return items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    productName: item.name,
  }));
}

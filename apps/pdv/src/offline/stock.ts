import { STORE, openLocalDatabase } from "./database";
import { updateMany } from "./idb";
import { listLocalProducts, invalidateProductsCache } from "./catalog";
import type { LocalProduct } from "./types";

/**
 * Estoque da base local.
 *
 * O estoque local acompanha as vendas em tempo real, com ou sem internet: a cada
 * venda gravada o saldo é debitado, e num cancelamento ele volta. Sem isso o
 * caixa venderia offline até o infinito o mesmo produto que já saiu da
 * prateleira, e todas as vendas excedentes seriam recusadas na sincronização.
 *
 * A fonte da verdade continua sendo o servidor, com a baixa por FIFO nos lotes de
 * compra. O que existe aqui é uma **projeção**: serve para bloquear a venda no
 * balcão, não para calcular custo nem consumir lote.
 */

/** Quanto sai de um produto. */
export interface StockMovement {
  productId: number;
  quantity: number;
}

/** Um produto cuja quantidade pedida não cabe no estoque local. */
export interface StockShortage {
  productId: number;
  productName: string;
  /** Quantidade pedida na venda. */
  requested: number;
  /** Estoque local no momento da conferência. */
  available: number;
}

/**
 * Confere se o estoque local cobre as quantidades pedidas.
 *
 * Pura, para poder ser testada sem IndexedDB.
 *
 * @param products Catálogo local.
 * @param movements Itens da venda com as quantidades.
 * @returns Os produtos que não têm saldo. Vazio significa que a venda pode entrar.
 */
export function findStockShortages(products: LocalProduct[], movements: StockMovement[]): StockShortage[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const shortages: StockShortage[] = [];

  for (const movement of movements) {
    const product = byId.get(movement.productId);

    // Produto fora da base local: o snapshot é anterior ao cadastro dele, ou ele
    // foi excluído. Sem saber o saldo, a venda offline não pode seguir.
    if (!product) {
      shortages.push({
        productId: movement.productId,
        productName: `Produto #${movement.productId}`,
        requested: movement.quantity,
        available: 0,
      });
      continue;
    }

    if (product.stock < movement.quantity) {
      shortages.push({
        productId: product.id,
        productName: product.name,
        requested: movement.quantity,
        available: product.stock,
      });
    }
  }

  return shortages;
}

/**
 * Confere o estoque local contra os itens da venda.
 *
 * @param movements Itens da venda.
 * @returns Os produtos sem saldo suficiente.
 */
export async function checkLocalStock(movements: StockMovement[]): Promise<StockShortage[]> {
  return findStockShortages(await listLocalProducts(), movements);
}

/**
 * Aplica um movimento de estoque na base local.
 *
 * @param movements Itens e quantidades.
 * @param direction `-1` debita (venda), `+1` devolve (cancelamento ou recusa na
 *   sincronização).
 */
async function applyStockMovement(movements: StockMovement[], direction: -1 | 1): Promise<void> {
  if (movements.length === 0) return;

  const db = await openLocalDatabase();

  // Uma transação só para todos os produtos: duas vendas simultâneas não podem
  // ler o mesmo saldo e gravar uma por cima da outra.
  await updateMany<LocalProduct>(
    db,
    STORE.products,
    movements.map((movement) => movement.productId),
    (current, key) => {
      if (!current) return null;

      const movement = movements.find((item) => item.productId === key);
      if (!movement) return null;

      // O saldo local nunca fica negativo: ele existe para bloquear venda, e um
      // número negativo bloquearia produto que na verdade tem estoque no servidor.
      const stock = Math.max(0, current.stock + direction * movement.quantity);
      return { ...current, stock };
    },
  );
  invalidateProductsCache();
}

/**
 * Debita o estoque local dos itens vendidos. Chamado em toda venda gravada,
 * online ou offline — a base local precisa refletir o balcão.
 */
export function consumeLocalStock(movements: StockMovement[]): Promise<void> {
  return applyStockMovement(movements, -1);
}

/**
 * Devolve ao estoque local os itens de uma venda que não vai existir: venda
 * cancelada, ou venda offline recusada na sincronização.
 */
export function restoreLocalStock(movements: StockMovement[]): Promise<void> {
  return applyStockMovement(movements, 1);
}

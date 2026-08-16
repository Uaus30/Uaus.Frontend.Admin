import { beforeEach, describe, expect, it } from "vitest";
import { resetLocalDatabase } from "@/test/local-database";
import { STORE, openLocalDatabase } from "./database";
import { getByKey, putAll } from "./idb";
import { checkLocalStock, consumeLocalStock, findStockShortages, restoreLocalStock } from "./stock";
import type { LocalProduct } from "./types";

/** Monta um produto da base local com o estoque informado. */
function product(id: number, name: string, stock: number): LocalProduct {
  return {
    id,
    name,
    barcode: `${id}`,
    price: 10,
    stock,
    status: 2,
    productGroupId: 1,
    searchName: name.toLowerCase(),
  };
}

const CATALOG = [product(1, "Café", 5), product(2, "Caneta", 0)];

describe("findStockShortages", () => {
  it("deve aceitar quantidade dentro do estoque", () => {
    expect(findStockShortages(CATALOG, [{ productId: 1, quantity: 5 }])).toEqual([]);
  });

  it("deve apontar quantidade acima do estoque", () => {
    const shortages = findStockShortages(CATALOG, [{ productId: 1, quantity: 6 }]);

    expect(shortages).toHaveLength(1);
    expect(shortages[0]).toMatchObject({
      productId: 1,
      productName: "Café",
      requested: 6,
      available: 5,
    });
  });

  it("deve apontar produto zerado", () => {
    expect(findStockShortages(CATALOG, [{ productId: 2, quantity: 1 }])).toHaveLength(1);
  });

  it("deve apontar produto ausente da base local", () => {
    // Snapshot anterior ao cadastro do produto: sem saber o saldo, a venda
    // offline não pode seguir.
    const shortages = findStockShortages(CATALOG, [{ productId: 99, quantity: 1 }]);

    expect(shortages).toHaveLength(1);
    expect(shortages[0]).toMatchObject({ productId: 99, available: 0 });
  });

  it("deve apontar todos os itens com falta, não só o primeiro", () => {
    const shortages = findStockShortages(CATALOG, [
      { productId: 1, quantity: 99 },
      { productId: 2, quantity: 1 },
    ]);

    expect(shortages.map((item) => item.productId)).toEqual([1, 2]);
  });

  it("deve aceitar venda sem itens", () => {
    expect(findStockShortages(CATALOG, [])).toEqual([]);
  });
});

/**
 * A projeção do estoque na base local, contra um IndexedDB de verdade.
 *
 * O contrato é curto e caro: **venda debita, cancelamento devolve**. Ele mora
 * numa transação de leitura-alteração-gravação (`updateMany`), e é o tipo de
 * coisa que um dublê de `idb.ts` não consegue provar — quem garante que duas
 * vendas simultâneas não leem o mesmo saldo é o banco, não o nosso código.
 */

/** Semeia o catálogo local com os produtos informados. */
async function seedProducts(products: LocalProduct[]): Promise<void> {
  const db = await openLocalDatabase();
  await putAll(db, STORE.products, products);
}

/** Estoque gravado de um produto, lido direto da store. */
async function storedStock(productId: number): Promise<number | undefined> {
  const db = await openLocalDatabase();
  return (await getByKey<LocalProduct>(db, STORE.products, productId))?.stock;
}

describe("estoque local na base de verdade", () => {
  beforeEach(async () => {
    resetLocalDatabase();
    await seedProducts([product(1, "Café", 10), product(2, "Caneta", 4)]);
  });

  it("deve debitar o saldo dos itens vendidos", async () => {
    // Sem o débito, o caixa venderia offline o mesmo produto até o infinito e
    // todas as vendas excedentes seriam recusadas na sincronização.
    await consumeLocalStock([
      { productId: 1, quantity: 3 },
      { productId: 2, quantity: 1 },
    ]);

    expect(await storedStock(1)).toBe(7);
    expect(await storedStock(2)).toBe(3);
  });

  it("deve devolver o saldo no cancelamento e voltar ao ponto de partida", async () => {
    // A devolução é o mesmo caminho usado quando o servidor recusa a venda na
    // sincronização: aquela venda não existe, e o saldo local estava mentindo
    // para baixo.
    await consumeLocalStock([{ productId: 1, quantity: 3 }]);
    await restoreLocalStock([{ productId: 1, quantity: 3 }]);

    expect(await storedStock(1)).toBe(10);
  });

  it("não deve deixar o saldo local negativo", async () => {
    // O saldo local existe para bloquear venda no balcão. Um número negativo
    // bloquearia produto que tem estoque de sobra no servidor — a projeção local
    // pode estar defasada, e o piso em zero limita o estrago a "não vende agora".
    await consumeLocalStock([{ productId: 2, quantity: 99 }]);

    expect(await storedStock(2)).toBe(0);
  });

  it("deve ignorar produto que não está na base local", async () => {
    // Snapshot anterior ao cadastro do produto. O movimento não pode explodir no
    // meio da venda: quem barra a venda é a conferência, não a gravação.
    await expect(consumeLocalStock([{ productId: 99, quantity: 1 }])).resolves.toBeUndefined();
    expect(await storedStock(1)).toBe(10);
  });

  it("não deve perder débito quando duas vendas saem ao mesmo tempo", async () => {
    // Regressão por construção: ler o saldo numa transação e gravar em outra
    // deixaria as duas vendas lendo 10 e gravando 7 e 8 — uma delas sumiria, e o
    // caixa liberaria offline mercadoria que já saiu da prateleira. A transação
    // única do `updateMany` é o que serializa as duas.
    await Promise.all([
      consumeLocalStock([{ productId: 1, quantity: 3 }]),
      consumeLocalStock([{ productId: 1, quantity: 2 }]),
    ]);

    expect(await storedStock(1)).toBe(5);
  });

  it("deve enxergar o débito na conferência seguinte, sem cache velho", async () => {
    // `listLocalProducts` guarda o catálogo em memória para a busca não gargalar.
    // Se o débito não invalidasse esse cache, a conferência continuaria vendo o
    // saldo de antes da venda e o caixa autorizaria a venda seguinte — que o
    // servidor recusaria depois, com o cliente já fora da loja.
    expect(await checkLocalStock([{ productId: 1, quantity: 10 }])).toEqual([]);

    await consumeLocalStock([{ productId: 1, quantity: 8 }]);

    const shortages = await checkLocalStock([{ productId: 1, quantity: 10 }]);
    expect(shortages).toHaveLength(1);
    expect(shortages[0]).toMatchObject({ productId: 1, requested: 10, available: 2 });
  });
});

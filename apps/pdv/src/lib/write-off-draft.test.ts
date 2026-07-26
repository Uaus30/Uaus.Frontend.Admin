import { describe, expect, it } from "vitest";
import {
  addDraftItem,
  findDraftShortages,
  removeDraftItem,
  setDraftQuantity,
  toWriteOffItems,
  totalDraftQuantity,
  type WriteOffDraftItem,
  type WriteOffProduct,
} from "./write-off-draft";

/** Produto como a busca o devolve. */
function product(id: number, name: string, stock: number): WriteOffProduct {
  return { id, name, barcode: `${id}`, stock };
}

/** Item já na lista da baixa. */
function draft(id: number, quantity: number, availableStock: number): WriteOffDraftItem {
  return { productId: id, name: `Produto ${id}`, barcode: `${id}`, quantity, availableStock };
}

describe("addDraftItem", () => {
  it("deve incluir o produto com quantidade 1", () => {
    const items = addDraftItem([], product(1, "Café", 5));

    expect(items).toEqual([
      { productId: 1, name: "Café", barcode: "1", quantity: 1, availableStock: 5 },
    ]);
  });

  it("deve somar em vez de repetir o produto", () => {
    // O backend recusa a baixa com o mesmo produto em dois itens.
    const items = addDraftItem(addDraftItem([], product(1, "Café", 5)), product(1, "Café", 5));

    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("deve atualizar o saldo conhecido ao reencontrar o produto", () => {
    // A segunda busca pode ter vindo do servidor com um número mais recente.
    const items = addDraftItem([draft(1, 1, 5)], product(1, "Café", 3));

    expect(items[0].availableStock).toBe(3);
  });

  it("não deve alterar a lista original", () => {
    const original = [draft(1, 1, 5)];

    addDraftItem(original, product(2, "Caneta", 4));

    expect(original).toHaveLength(1);
  });
});

describe("setDraftQuantity", () => {
  it("deve trocar a quantidade do item apontado", () => {
    const items = setDraftQuantity([draft(1, 1, 5), draft(2, 1, 5)], 2, 4);

    expect(items.map((item) => item.quantity)).toEqual([1, 4]);
  });

  it("deve manter o piso em 1", () => {
    // Zero seria um item que não baixa nada, e o backend recusaria a baixa
    // inteira por causa dele. Para tirar o produto, remove-se o item.
    expect(setDraftQuantity([draft(1, 3, 5)], 1, 0)[0].quantity).toBe(1);
    expect(setDraftQuantity([draft(1, 3, 5)], 1, -7)[0].quantity).toBe(1);
  });

  it("deve descartar quantidade não numérica", () => {
    expect(setDraftQuantity([draft(1, 3, 5)], 1, Number.NaN)[0].quantity).toBe(1);
  });

  it("deve truncar fração", () => {
    // Baixa é em unidades inteiras; `Quantity` é `int` no backend.
    expect(setDraftQuantity([draft(1, 1, 5)], 1, 2.9)[0].quantity).toBe(2);
  });
});

describe("removeDraftItem", () => {
  it("deve tirar só o produto apontado", () => {
    expect(removeDraftItem([draft(1, 1, 5), draft(2, 1, 5)], 1).map((i) => i.productId)).toEqual([2]);
  });
});

describe("findDraftShortages", () => {
  it("deve aceitar quantidade dentro do saldo", () => {
    expect(findDraftShortages([draft(1, 5, 5)])).toEqual([]);
  });

  it("deve apontar quantidade acima do saldo", () => {
    expect(findDraftShortages([draft(1, 6, 5)]).map((i) => i.productId)).toEqual([1]);
  });

  it("deve apontar todos os itens com falta, não só o primeiro", () => {
    const shortages = findDraftShortages([draft(1, 99, 5), draft(2, 1, 5), draft(3, 2, 0)]);

    expect(shortages.map((item) => item.productId)).toEqual([1, 3]);
  });

  it("deve aceitar lista vazia", () => {
    expect(findDraftShortages([])).toEqual([]);
  });
});

describe("totalDraftQuantity", () => {
  it("deve somar as quantidades", () => {
    expect(totalDraftQuantity([draft(1, 2, 5), draft(2, 3, 5)])).toBe(5);
  });

  it("deve devolver zero com a lista vazia", () => {
    expect(totalDraftQuantity([])).toBe(0);
  });
});

describe("toWriteOffItems", () => {
  it("deve levar o nome do produto para a fila offline", () => {
    // A lista de pendências precisa dele, e a base local pode ter mudado quando
    // a baixa subir.
    expect(toWriteOffItems([draft(1, 2, 5)])).toEqual([
      { productId: 1, quantity: 2, productName: "Produto 1" },
    ]);
  });
});

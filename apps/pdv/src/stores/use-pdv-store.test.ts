import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_CONSUMER, usePdvStore, type PdvItem } from "./use-pdv-store";

/** Estado inicial de um carrinho vazio, usado entre os testes. */
const EMPTY = {
  status: "IDLE" as const,
  items: [],
  globalDiscount: 0,
  editingSaleId: null,
  consumer: EMPTY_CONSUMER,
  heldSales: [],
  saleClientReference: null,
};

/** Produto de referência: R$ 10,00 com 20 unidades em estoque. */
function product(overrides: Partial<Omit<PdvItem, "id">> = {}): Omit<PdvItem, "id"> {
  return {
    productId: 1,
    name: "CANECA DE PORCELANA",
    barcode: "7891234567890",
    price: 10,
    quantity: 1,
    discount: 0,
    availableStock: 20,
    ...overrides,
  };
}

describe("usePdvStore", () => {
  beforeEach(() => {
    usePdvStore.setState(EMPTY);
  });

  describe("carrinho", () => {
    it("deve entrar em venda ao adicionar o primeiro item", () => {
      usePdvStore.getState().addItem(product());

      const state = usePdvStore.getState();
      expect(state.status).toBe("SELLING");
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBeTruthy();
    });

    it("deve somar a quantidade quando o mesmo produto é lido de novo", () => {
      const { addItem } = usePdvStore.getState();
      addItem(product());
      addItem(product({ quantity: 2 }));

      const items = usePdvStore.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(3);
    });

    it("deve manter linhas separadas para produtos diferentes", () => {
      const { addItem } = usePdvStore.getState();
      addItem(product());
      addItem(product({ productId: 2, name: "TESOURA" }));

      expect(usePdvStore.getState().items).toHaveLength(2);
    });

    it("deve voltar a ocioso ao esvaziar o carrinho", () => {
      usePdvStore.getState().addItem(product());
      const [item] = usePdvStore.getState().items;

      usePdvStore.getState().removeItem(item.id);

      const state = usePdvStore.getState();
      expect(state.items).toHaveLength(0);
      expect(state.status).toBe("IDLE");
    });

    it("deve continuar em venda ao remover apenas uma das linhas", () => {
      const { addItem } = usePdvStore.getState();
      addItem(product());
      addItem(product({ productId: 2 }));

      usePdvStore.getState().removeItem(usePdvStore.getState().items[0].id);

      expect(usePdvStore.getState().status).toBe("SELLING");
    });

    it("deve atualizar a quantidade da linha", () => {
      usePdvStore.getState().addItem(product());
      const [item] = usePdvStore.getState().items;

      usePdvStore.getState().updateQuantity(item.id, 7);

      expect(usePdvStore.getState().items[0].quantity).toBe(7);
    });
  });

  describe("totais", () => {
    it("deve somar quantidade x preço no subtotal", () => {
      usePdvStore.getState().addItem(product({ quantity: 3 }));

      expect(usePdvStore.getState().getSubtotal()).toBe(30);
      expect(usePdvStore.getState().getTotal()).toBe(30);
    });

    it("deve descontar o desconto do item antes de multiplicar pela quantidade", () => {
      usePdvStore.getState().addItem(product({ quantity: 2 }));
      const [item] = usePdvStore.getState().items;

      usePdvStore.getState().applyItemDiscount(item.id, 2.5);

      expect(usePdvStore.getState().getSubtotal()).toBe(15);
    });

    it("deve subtrair o desconto da venda do total", () => {
      usePdvStore.getState().addItem(product({ quantity: 4 }));
      usePdvStore.getState().applyGlobalDiscount(12);

      expect(usePdvStore.getState().getSubtotal()).toBe(40);
      expect(usePdvStore.getState().getTotal()).toBe(28);
    });

    it("não deve deixar o total ficar negativo", () => {
      usePdvStore.getState().addItem(product());
      usePdvStore.getState().applyGlobalDiscount(999);

      expect(usePdvStore.getState().getTotal()).toBe(0);
    });
  });

  describe("checkout", () => {
    it("deve abrir o checkout com o carrinho cheio", () => {
      usePdvStore.getState().addItem(product());
      usePdvStore.getState().setCheckout();

      expect(usePdvStore.getState().status).toBe("CHECKOUT");
    });

    it("não deve abrir o checkout com o carrinho vazio", () => {
      usePdvStore.getState().setCheckout();

      expect(usePdvStore.getState().status).toBe("IDLE");
    });

    it("deve voltar para a venda ao sair do checkout", () => {
      usePdvStore.getState().addItem(product());
      usePdvStore.getState().setCheckout();
      usePdvStore.getState().backToSelling();

      expect(usePdvStore.getState().status).toBe("SELLING");
    });
  });

  describe("encerramento da venda", () => {
    it("deve limpar carrinho, desconto e edição ao finalizar", () => {
      usePdvStore.getState().addItem(product());
      usePdvStore.getState().applyGlobalDiscount(5);
      usePdvStore.getState().setEditingSaleId(42);

      usePdvStore.getState().finishSale();

      const state = usePdvStore.getState();
      expect(state.items).toHaveLength(0);
      expect(state.globalDiscount).toBe(0);
      expect(state.editingSaleId).toBeNull();
      expect(state.status).toBe("IDLE");
    });

    it("deve descartar a venda em andamento ao cancelar", () => {
      usePdvStore.getState().addItem(product());
      usePdvStore.getState().cancelSale();

      expect(usePdvStore.getState().items).toHaveLength(0);
      expect(usePdvStore.getState().status).toBe("IDLE");
    });
  });

  describe("chave de idempotência da venda", () => {
    it("deve gerar a chave uma vez e reutilizá-la nas retentativas", () => {
      // Regressão da venda duplicada: cada clique em "Confirmar" gerava chave
      // nova, então a retentativa após um 504 (com a venda já gravada no
      // servidor) criava uma SEGUNDA venda que o índice único não barrava. A
      // chave é do checkout: a mesma em toda tentativa da mesma venda.
      const generate = vi.fn(() => `chave-${generate.mock.calls.length}`);

      const first = usePdvStore.getState().ensureSaleClientReference(generate);
      const second = usePdvStore.getState().ensureSaleClientReference(generate);

      expect(first).toBe("chave-1");
      expect(second).toBe(first);
      expect(generate).toHaveBeenCalledTimes(1);
    });

    it("deve descartar a chave quando a venda confirma", () => {
      const generate = vi.fn(() => `chave-${generate.mock.calls.length}`);

      const before = usePdvStore.getState().ensureSaleClientReference(generate);
      usePdvStore.getState().finishSale();
      const after = usePdvStore.getState().ensureSaleClientReference(generate);

      expect(after).not.toBe(before);
    });

    it("deve descartar a chave quando a venda é cancelada", () => {
      const generate = vi.fn(() => `chave-${generate.mock.calls.length}`);

      usePdvStore.getState().ensureSaleClientReference(generate);
      usePdvStore.getState().cancelSale();

      expect(usePdvStore.getState().saleClientReference).toBeNull();
    });

    it("deve descartar a chave ao pausar a venda", () => {
      // A chave pertence à venda pausada; mantê-la faria a próxima venda nova
      // reutilizar a chave de outra venda e ser engolida como "duplicada".
      const generate = vi.fn(() => `chave-${generate.mock.calls.length}`);

      usePdvStore.getState().addItem(product());
      usePdvStore.getState().ensureSaleClientReference(generate);
      usePdvStore.getState().holdSale();

      expect(usePdvStore.getState().saleClientReference).toBeNull();
    });

    it("deve descartar a chave ao encerrar a sessão", () => {
      const generate = vi.fn(() => `chave-${generate.mock.calls.length}`);

      usePdvStore.getState().ensureSaleClientReference(generate);
      usePdvStore.getState().clearSession();

      expect(usePdvStore.getState().saleClientReference).toBeNull();
    });
  });

  describe("vendas em espera", () => {
    it("deve guardar a venda em andamento e liberar o caixa", () => {
      const { addItem } = usePdvStore.getState();
      addItem(product({ quantity: 3 }));
      usePdvStore.getState().applyGlobalDiscount(5);
      usePdvStore.getState().setConsumer({ customerId: null, name: "Maria", document: "123" });

      const held = usePdvStore.getState().holdSale();

      expect(held).not.toBeNull();
      expect(held!.total).toBe(25);
      expect(held!.consumer.name).toBe("Maria");

      const state = usePdvStore.getState();
      expect(state.heldSales).toHaveLength(1);
      expect(state.items).toHaveLength(0);
      expect(state.status).toBe("IDLE");
      expect(state.globalDiscount).toBe(0);
      expect(state.consumer).toEqual(EMPTY_CONSUMER);
    });

    it("não deve pausar com o carrinho vazio", () => {
      expect(usePdvStore.getState().holdSale()).toBeNull();
      expect(usePdvStore.getState().heldSales).toHaveLength(0);
    });

    it("não deve pausar durante a reedição de uma venda já gravada", () => {
      const items: PdvItem[] = [{ ...product(), id: "linha-1" }];
      usePdvStore.getState().loadSaleForEditing(99, items, 0);

      expect(usePdvStore.getState().holdSale()).toBeNull();
      expect(usePdvStore.getState().heldSales).toHaveLength(0);
    });

    it("deve devolver a venda em espera ao carrinho e tirá-la da fila", () => {
      usePdvStore.getState().addItem(product({ quantity: 2 }));
      usePdvStore.getState().setConsumer({ customerId: 7, name: "João", document: "999" });
      const held = usePdvStore.getState().holdSale()!;

      const resumed = usePdvStore.getState().resumeHeldSale(held.id);

      expect(resumed?.id).toBe(held.id);

      const state = usePdvStore.getState();
      expect(state.heldSales).toHaveLength(0);
      expect(state.status).toBe("SELLING");
      expect(state.items).toHaveLength(1);
      expect(state.consumer.customerId).toBe(7);
    });

    it("não deve retomar por cima de um carrinho com itens", () => {
      usePdvStore.getState().addItem(product());
      const held = usePdvStore.getState().holdSale()!;
      usePdvStore.getState().addItem(product({ productId: 2, name: "OUTRO" }));

      expect(usePdvStore.getState().resumeHeldSale(held.id)).toBeNull();
      expect(usePdvStore.getState().heldSales).toHaveLength(1);
    });

    it("deve empilhar a mais recente no topo da fila", () => {
      usePdvStore.getState().addItem(product());
      const first = usePdvStore.getState().holdSale()!;
      usePdvStore.getState().addItem(product({ productId: 2, name: "OUTRO" }));
      const second = usePdvStore.getState().holdSale()!;

      expect(usePdvStore.getState().heldSales.map((sale) => sale.id)).toEqual([second.id, first.id]);
    });

    it("deve descartar uma venda em espera", () => {
      usePdvStore.getState().addItem(product());
      const held = usePdvStore.getState().holdSale()!;

      usePdvStore.getState().discardHeldSale(held.id);

      expect(usePdvStore.getState().heldSales).toHaveLength(0);
    });

    it("deve manter a fila de espera ao encerrar a sessão do operador", () => {
      usePdvStore.getState().addItem(product());
      usePdvStore.getState().holdSale();

      usePdvStore.getState().clearSession();

      expect(usePdvStore.getState().heldSales).toHaveLength(1);
    });
  });

  describe("consumidor", () => {
    it("deve limpar o consumidor ao finalizar a venda", () => {
      usePdvStore.getState().addItem(product());
      usePdvStore.getState().setConsumer({ customerId: 3, name: "Ana", document: "111" });

      usePdvStore.getState().finishSale();

      expect(usePdvStore.getState().consumer).toEqual(EMPTY_CONSUMER);
    });

    it("deve limpar o consumidor ao cancelar a venda", () => {
      usePdvStore.getState().setConsumer({ customerId: null, name: "Ana", document: "" });

      usePdvStore.getState().cancelSale();

      expect(usePdvStore.getState().consumer).toEqual(EMPTY_CONSUMER);
    });
  });

  describe("tamanho da fonte", () => {
    beforeEach(() => {
      usePdvStore.getState().resetFontScale();
    });

    it("deve abrir em 100% quando não há preferência salva", async () => {
      // A escala inicial é lida na carga do módulo, então o teste precisa de uma
      // instância nova. Number(null) é zero, que é um índice válido: sem tratar
      // a ausência da chave, o PDV abriria na menor fonte sem ninguém ter pedido.
      localStorage.removeItem("pdv-font-scale-index");
      vi.resetModules();

      const fresh = await import("./use-pdv-store");

      expect(fresh.FONT_SCALES[fresh.usePdvStore.getState().fontScaleIndex]).toBe(1);
    });

    it("deve abrir com o tamanho que o operador tinha escolhido", async () => {
      localStorage.setItem("pdv-font-scale-index", "4");
      vi.resetModules();

      const fresh = await import("./use-pdv-store");

      expect(fresh.usePdvStore.getState().fontScaleIndex).toBe(4);
      localStorage.removeItem("pdv-font-scale-index");
    });

    it("deve aumentar e diminuir um degrau por vez", () => {
      const start = usePdvStore.getState().fontScaleIndex;

      usePdvStore.getState().stepFontScale(1);
      expect(usePdvStore.getState().fontScaleIndex).toBe(start + 1);

      usePdvStore.getState().stepFontScale(-1);
      expect(usePdvStore.getState().fontScaleIndex).toBe(start);
    });

    it("não deve passar do menor tamanho", () => {
      for (let step = 0; step < 10; step += 1) usePdvStore.getState().stepFontScale(-1);

      expect(usePdvStore.getState().fontScaleIndex).toBe(0);
    });

    it("deve voltar ao padrão de 100%", () => {
      usePdvStore.getState().stepFontScale(1);
      usePdvStore.getState().resetFontScale();

      expect(document.documentElement.style.fontSize).toBe("100%");
    });
  });

  describe("edição de venda", () => {
    it("deve carregar os itens da venda e marcar qual está em edição", () => {
      const items: PdvItem[] = [{ ...product(), id: "linha-1", quantity: 2, discount: 1 }];

      usePdvStore.getState().loadSaleForEditing(99, items, 5);

      const state = usePdvStore.getState();
      expect(state.editingSaleId).toBe(99);
      expect(state.status).toBe("SELLING");
      expect(state.globalDiscount).toBe(5);
      expect(state.getSubtotal()).toBe(18);
      expect(state.getTotal()).toBe(13);
    });
  });
});

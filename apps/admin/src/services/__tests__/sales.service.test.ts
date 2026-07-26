import { beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
const extractCreatedId = vi.fn();
const fetchAllPages = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
  apiPost: (...args: unknown[]) => apiPost(...args),
  apiDelete: (...args: unknown[]) => apiDelete(...args),
  extractCreatedId: (...args: unknown[]) => extractCreatedId(...args),
  fetchAllPages: (...args: unknown[]) => fetchAllPages(...args),
}));

const { createSaleWithItems, deleteSaleWithItems, getSaleItems } = await import("../sales.service");

/** Carrinho de referência: 2 x R$ 25,00 + 1 x R$ 50,00. */
const ITEMS = [
  { productId: 1, quantity: 2, unitPrice: 25 },
  { productId: 2, quantity: 1, unitPrice: 50 },
];

/** Corpo enviado na chamada de número `index` do apiPost. */
function postBody(index: number) {
  return apiPost.mock.calls[index][1] as Record<string, any>;
}

describe("createSaleWithItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiPost.mockResolvedValue({ data: null, response: {} });
    extractCreatedId.mockReturnValue(77);
  });

  it("deve calcular o total a partir dos itens menos o desconto", async () => {
    await createSaleWithItems({
      customerId: null,
      discount: 20,
      payments: [{ paymentMethodId: 1, amount: 80 }],
      paymentStatus: 2,
      items: ITEMS,
    });

    expect(postBody(0).total).toBe(80);
    expect(postBody(0).discount).toBe(20);
  });

  it("não deve deixar o total ficar negativo", async () => {
    await createSaleWithItems({
      customerId: null,
      discount: 999,
      payments: [{ paymentMethodId: 1, amount: 0 }],
      paymentStatus: 2,
      items: ITEMS,
    });

    expect(postBody(0).total).toBe(0);
  });

  it("deve enviar todas as formas de pagamento normalizadas", async () => {
    await createSaleWithItems({
      customerId: 9,
      discount: 0,
      payments: [
        { paymentMethodId: 1, amount: 60 },
        { paymentMethodId: 3, amount: 40, installments: 2, transactionFee: 2.16, paymentMethodInstallmentId: 4 },
      ],
      paymentStatus: 2,
      items: ITEMS,
    });

    const body = postBody(0);
    expect(body.customerId).toBe(9);
    expect(body.payments).toEqual([
      { paymentMethodId: 1, paymentMethodInstallmentId: null, amount: 60, installments: 1, transactionFee: 0 },
      { paymentMethodId: 3, paymentMethodInstallmentId: 4, amount: 40, installments: 2, transactionFee: 2.16 },
    ]);
  });

  it("deve lançar um item por linha depois de criar a venda", async () => {
    await createSaleWithItems({
      customerId: null,
      discount: 0,
      payments: [{ paymentMethodId: 1, amount: 100 }],
      paymentStatus: 2,
      items: ITEMS,
    });

    expect(apiPost).toHaveBeenCalledTimes(3);
    expect(postBody(1)).toEqual({ saleId: 77, productId: 1, quantity: 2, unitPrice: 25 });
    expect(postBody(2)).toEqual({ saleId: 77, productId: 2, quantity: 1, unitPrice: 50 });
  });

  it("deve limpar a observação em branco", async () => {
    await createSaleWithItems({
      customerId: null,
      discount: 0,
      payments: [{ paymentMethodId: 1, amount: 100 }],
      paymentStatus: 2,
      notes: "   ",
      items: ITEMS,
    });

    expect(postBody(0).notes).toBeNull();
  });

  it("deve falhar quando não consegue identificar a venda criada", async () => {
    extractCreatedId.mockReturnValue(null);

    await expect(
      createSaleWithItems({
        customerId: null,
        discount: 0,
        payments: [{ paymentMethodId: 1, amount: 100 }],
        paymentStatus: 2,
        items: ITEMS,
      }),
    ).rejects.toThrow("Não foi possível identificar a venda criada.");
  });
});

describe("deleteSaleWithItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAllPages.mockResolvedValue([{ id: 900 }, { id: 901 }]);
  });

  it("deve buscar apenas os itens da venda informada", async () => {
    await getSaleItems(77);

    expect(fetchAllPages).toHaveBeenCalledWith("/SaleItems", { saleId: 77 });
  });

  it("deve apagar os itens antes da venda para devolver o estoque", async () => {
    await deleteSaleWithItems(77);

    expect(apiDelete.mock.calls.map((call) => call[0])).toEqual([
      "/SaleItems/900",
      "/SaleItems/901",
      "/Sales/77",
    ]);
  });
});

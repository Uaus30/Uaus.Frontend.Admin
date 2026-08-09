import { beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiDelete = vi.fn();
const extractCreatedId = vi.fn();
const fetchAllPages = vi.fn();
const createCompleteSale = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
  apiPost: (...args: unknown[]) => apiPost(...args),
  apiDelete: (...args: unknown[]) => apiDelete(...args),
  extractCreatedId: (...args: unknown[]) => extractCreatedId(...args),
  fetchAllPages: (...args: unknown[]) => fetchAllPages(...args),
  createCompleteSale: (...args: unknown[]) => createCompleteSale(...args),
}));

const { createSaleWithItems, deleteSaleWithItems, getSaleItems } = await import("../sales.service");

/** Carrinho de referência: 2 x R$ 25,00 + 1 x R$ 50,00. */
const ITEMS = [
  { productId: 1, quantity: 2, unitPrice: 25 },
  { productId: 2, quantity: 1, unitPrice: 50 },
];



describe("createSaleWithItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createCompleteSale.mockResolvedValue(77);
  });

  it("deve repassar o payload para createCompleteSale", async () => {
    const payload = {
      customerId: 9,
      discount: 20,
      payments: [{ paymentMethodId: 1, amount: 80, paymentMethodInstallmentId: null, installments: 1, transactionFee: 0 }],
      items: ITEMS,
    };

    const result = await createSaleWithItems(payload);

    expect(createCompleteSale).toHaveBeenCalledWith(payload);
    expect(result).toBe(77);
  });

  it("deve falhar quando não consegue identificar a venda criada", async () => {
    createCompleteSale.mockResolvedValue(null);

    await expect(
      createSaleWithItems({
        customerId: null,
        discount: 0,
        payments: [{ paymentMethodId: 1, amount: 100, paymentMethodInstallmentId: null, installments: 1, transactionFee: 0 }],
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

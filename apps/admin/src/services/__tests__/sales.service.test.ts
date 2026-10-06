import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchAllPages = vi.fn();

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  fetchAllPages: (...args: unknown[]) => fetchAllPages(...args),
}));

const salesService = await import("../sales.service");

describe("sales.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAllPages.mockResolvedValue([{ id: 900 }, { id: 901 }]);
  });

  it("deve buscar apenas os itens da venda informada", async () => {
    await salesService.getSaleItems(77);

    expect(fetchAllPages).toHaveBeenCalledWith("/SaleItems", { saleId: 77 });
  });

  it("não oferece mais exclusão de venda — venda registrada só se cancela (06/10/2026)", () => {
    expect(Object.keys(salesService)).not.toContain("deleteSaleWithItems");
  });
});

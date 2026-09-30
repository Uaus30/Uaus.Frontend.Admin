import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductSaleDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetProductSales: vi.fn(),
}));

// Só o que fala com a rede é dublado; a chave de cache vem do módulo real.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetProductSales: mocks.useGetProductSales,
}));

const { useProductSales, PRODUCT_SALES_PAGE_SIZE } = await import("../useProductSales");

const venda: ProductSaleDto = {
  saleId: 1945,
  saleItemId: 501,
  createdAt: "2026-09-02T08:52:54",
  quantity: 1,
  unitPrice: 20,
  discount: 2,
  subtotal: 20,
  paymentStatus: "Paid",
};

function pagina(total: number) {
  return { data: [venda], page: 1, limit: PRODUCT_SALES_PAGE_SIZE, total, totalPages: 1 };
}

describe("useProductSales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetProductSales.mockReturnValue({ data: pagina(1), isLoading: false, isError: false });
  });

  it("consulta o produto na página pedida, com o tamanho da aba", () => {
    const { result } = renderHook(() => useProductSales(39));

    expect(mocks.useGetProductSales).toHaveBeenLastCalledWith(39, {
      page: 1,
      limit: PRODUCT_SALES_PAGE_SIZE,
    });
    expect(result.current.sales).toEqual([venda]);
    expect(result.current.total).toBe(1);

    act(() => result.current.setPage(3));
    expect(mocks.useGetProductSales).toHaveBeenLastCalledWith(39, {
      page: 3,
      limit: PRODUCT_SALES_PAGE_SIZE,
    });
  });

  it("volta para a página 1 ao trocar de variação", () => {
    // A página 3 de uma variação com trinta vendas não existe na irmã com cinco:
    // sem o reset, a aba abriria vazia sem dizer por quê.
    const { result, rerender } = renderHook(({ id }) => useProductSales(id), { initialProps: { id: 39 } });
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ id: 41 });

    expect(result.current.page).toBe(1);
    expect(mocks.useGetProductSales).toHaveBeenLastCalledWith(41, {
      page: 1,
      limit: PRODUCT_SALES_PAGE_SIZE,
    });
  });

  it("abre e fecha a venda escolhida pelo olho", () => {
    const { result } = renderHook(() => useProductSales(39));
    expect(result.current.viewSaleId).toBeNull();

    act(() => result.current.openSale(1945));
    expect(result.current.viewSaleId).toBe(1945);

    act(() => result.current.closeSale());
    expect(result.current.viewSaleId).toBeNull();
  });

  it("sem resposta ainda, a lista é vazia e o total é zero", () => {
    // É o que a API omite (nada carregado) — e o rodapé não pode dividir por ele.
    mocks.useGetProductSales.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    const { result } = renderHook(() => useProductSales(null));

    expect(result.current.sales).toEqual([]);
    expect(result.current.total).toBe(0);
    expect(result.current.isLoading).toBe(true);
  });
});

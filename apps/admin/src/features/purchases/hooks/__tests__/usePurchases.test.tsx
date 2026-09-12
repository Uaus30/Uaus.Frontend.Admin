import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useGetPurchases: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("wouter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("wouter")>()),
  useLocation: () => ["/estoque/compras", mocks.navigate],
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPurchases: mocks.useGetPurchases,
}));

vi.mock("@/hooks/use-catalog", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-catalog")>()),
  useAllSuppliers: () => ({ data: [] }),
}));

vi.mock("@/services/images.service", () => ({
  createImageFromFile: vi.fn(),
  downloadWebImageAsFile: vi.fn(),
}));

const { usePurchases, purchasesStatusParams, STATUS_FILTER_ALL, STATUS_FILTER_OPEN } =
  await import("../usePurchases");

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Os parâmetros da última consulta feita pela tela. */
function lastQueryParams(): Record<string, unknown> {
  const calls = mocks.useGetPurchases.mock.calls;
  return calls[calls.length - 1][0] as Record<string, unknown>;
}

/** Uma compra em aberto, como a API a devolve. */
function compra(extras: Record<string, unknown> = {}) {
  return {
    id: 7,
    createdAt: "2026-09-12T10:00:00",
    updatedAt: null,
    supplierId: 1,
    supplierName: "Shopee",
    productName: "SACOLA REUTILIZÁVEL",
    purchaseDate: "2026-09-12T00:00:00",
    quantity: 20,
    grossTotal: 0,
    finalTotal: 90,
    unitGross: 0,
    unitFinal: 4.5,
    adjustmentPercent: 0,
    status: "InTransit",
    images: [],
    items: [],
    costSplitManual: false,
    replaceProductImages: true,
    ...extras,
  } as never;
}

describe("usePurchases — o caminho do 'Lançar recebimento'", () => {
  beforeEach(() => {
    mocks.navigate.mockClear();
    mocks.useGetPurchases.mockReturnValue({ data: { data: [], total: 0 }, isLoading: false });
  });

  it("compra com VARIAÇÕES abre o diálogo, e não o cadastro de produto novo", () => {
    // REGRESSÃO (dev, 12/09/2026): a compra do grupo 805 com quatro variações
    // caiu no cadastro em branco e gerou o grupo 885 — um produto novo, SEM
    // variações, com as 20 unidades entrando no lugar errado. O cabeçalho de uma
    // compra com grade não aponta para variação nenhuma; quem responde é o grupo.
    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });

    act(() => {
      result.current.startReceive(
        compra({
          productId: null,
          productGroupId: 805,
          items: [
            {
              id: 6,
              productId: 964,
              productName: "SACOLA [ARARA]",
              quantity: 5,
              grossTotal: 0,
              finalTotal: 20,
              stock: 1,
              unitFinal: 4,
            },
            {
              id: 7,
              productId: 963,
              productName: "SACOLA [CACHORRO]",
              quantity: 5,
              grossTotal: 0,
              finalTotal: 20,
              stock: 1,
              unitFinal: 4,
            },
          ],
        }),
      );
    });

    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(result.current.receiving).not.toBeNull();
    expect(result.current.receiveForm.items).toHaveLength(2);
  });

  it("compra de produto NOVO continua abrindo o cadastro preenchido", () => {
    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });

    act(() => {
      result.current.startReceive(compra({ productId: null, productGroupId: null }));
    });

    expect(mocks.navigate).toHaveBeenCalledWith("/produtos?compra=7");
    expect(result.current.receiving).toBeNull();
  });

  it("compra de UMA variação abre o diálogo, como sempre", () => {
    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });

    act(() => {
      result.current.startReceive(compra({ productId: 963, productGroupId: 805 }));
    });

    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(result.current.receiving).not.toBeNull();
  });
});

describe("purchasesStatusParams", () => {
  it("traduz os dois valores especiais e o código de situação", () => {
    expect(purchasesStatusParams(STATUS_FILTER_OPEN)).toEqual({ onlyOpen: true });
    expect(purchasesStatusParams(STATUS_FILTER_ALL)).toEqual({});
    expect(purchasesStatusParams("3")).toEqual({ status: 3 });
  });
});

describe("usePurchases — filtro de situação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetPurchases.mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null });
  });

  it("abre em Não lançadas: pede só as compras em aberto, sem código de situação", () => {
    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });

    expect(result.current.statusFilter).toBe(STATUS_FILTER_OPEN);
    expect(lastQueryParams()).toMatchObject({ onlyOpen: true, page: 1 });
    expect(lastQueryParams()).not.toHaveProperty("status");
  });

  it("trocar para uma situação ou para todas tira o onlyOpen e volta à página 1", () => {
    const { result } = renderHook(() => usePurchases(), { wrapper: createWrapper() });

    act(() => result.current.setPage(3));
    act(() => result.current.setStatusFilter("3")); // Lançado

    expect(result.current.page).toBe(1);
    expect(lastQueryParams()).toMatchObject({ status: 3, page: 1 });
    expect(lastQueryParams().onlyOpen).toBeUndefined();

    act(() => result.current.setStatusFilter(STATUS_FILTER_ALL));
    expect(lastQueryParams()).not.toHaveProperty("status");
    expect(lastQueryParams().onlyOpen).toBeUndefined();
  });
});

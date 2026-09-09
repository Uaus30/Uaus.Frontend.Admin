import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useGetPurchases: vi.fn(),
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

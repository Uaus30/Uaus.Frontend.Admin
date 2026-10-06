import { renderHook, act } from "@testing-library/react";
import { useSales } from "../useSales";
import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGetFinancialClosings, useGetSales } from "@workspace/api-client-react";

// Mock the services
vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn(() => Promise.resolve([{ id: 1, name: "Pix", allowSelect: true }])),
}));

vi.mock("@/services/customers.service", () => ({
  getAllCustomers: vi.fn(() => Promise.resolve([{ id: 10, name: "Cust 10" }])),
}));

vi.mock("@/services/sales.service", () => ({
  getSaleItems: vi.fn(() => Promise.resolve([])),
}));

const cancelSaleMock = vi.hoisted(() => vi.fn(() => Promise.resolve(null)));

// Mock api client react queries
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetSales: vi.fn(() => ({
    data: {
      data: [],
      total: 0,
      limit: 15,
      page: 1,
    },
    isLoading: false,
  })),
  useGetPaymentMethods: vi.fn(() => ({
    data: {
      data: [{ id: 1, name: "Pix", isActive: true, installments: [] }],
      page: 1,
      limit: 100,
      total: 1,
      totalPages: 1,
    },
    isLoading: false,
  })),
  // Identidade da loja para o cupom reimpresso; sem dado, o cupom cai no padrão.
  useGetCompanySettings: vi.fn(() => ({ data: undefined, isLoading: false })),
  getGetSalesQueryKey: () => ["sales-page"],
  useGetFinancialClosings: vi.fn(() => ({ data: { data: [] } })),
  useGetStockCorrections: vi.fn(() => ({ data: undefined })),
  cancelSale: cancelSaleMock,
  PRODUCT_STATUS: { None: 0, Draft: 1, Active: 2, OutOfStock: 3, Inactive: 4 },
  enumCode: (value: unknown) => (typeof value === "number" ? value : 0),
}));

// Mock the toast hook
const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

// Helper wrapper for React Query
let queryClient: QueryClient;
const createWrapper = () => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useSales Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should initialize with default states", () => {
    const { result } = renderHook(() => useSales(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.search).toBe("");
    expect(result.current.startDate).toBe("");
    expect(result.current.endDate).toBe("");
    expect(result.current.paymentMethodFilter).toBe("all");
    expect(result.current.paymentStatusFilter).toBe("all");
    expect(result.current.createModalOpen).toBe(false);
    expect(result.current.viewSaleId).toBeNull();
    expect(result.current.saleToEdit).toBeNull();
    // O rascunho da Nova venda mora no useNewSaleDraft (06/10/2026).
    expect(result.current.newSale.items).toEqual([]);
    expect(result.current.newSale.total).toBe(0);
  });

  it("abrir a Nova venda começa um rascunho em branco, com a primeira forma de pagamento", () => {
    const { result } = renderHook(() => useSales(), { wrapper: createWrapper() });

    act(() => {
      result.current.openNewSale();
    });

    expect(result.current.createModalOpen).toBe(true);
    expect(result.current.newSale.payments).toEqual([{ paymentMethodId: 1, amount: 0 }]);
  });

  it("deve enviar o fim do dia LOCAL no endDate para incluir o último dia do período", () => {
    // Regressão: o backend compara `CreatedAt <= endDate` com hora; enviar a
    // data crua (meia-noite) fazia as vendas do último dia sumirem do filtro.
    const { result } = renderHook(() => useSales(), { wrapper: createWrapper() });

    act(() => {
      result.current.setStartDate("2026-08-07");
      result.current.setEndDate("2026-08-07");
    });

    const calls = vi.mocked(useGetSales).mock.calls;
    const lastParams = calls[calls.length - 1][0] as Record<string, unknown>;

    expect(lastParams.startDate).toBe("2026-08-07");
    expect(lastParams.endDate).toBe("2026-08-07T23:59:59");
    // Sem `Z`: o backend grava e compara em horário local (docs/fuso-horario.md).
    expect(String(lastParams.endDate)).not.toContain("Z");
  });

  it("não deve enviar endDate quando o filtro de período está vazio", () => {
    const { result } = renderHook(() => useSales(), { wrapper: createWrapper() });

    const calls = vi.mocked(useGetSales).mock.calls;
    const lastParams = calls[calls.length - 1][0] as Record<string, unknown>;

    expect(result.current.endDate).toBe("");
    expect(lastParams.endDate).toBeUndefined();
    expect(lastParams.startDate).toBeUndefined();
  });

  it("cancelar manda o motivo, descarta o detalhe da venda e fecha o diálogo (06/10/2026)", async () => {
    // Venda registrada não se exclui: no máximo se cancela, com motivo.
    const { result } = renderHook(() => useSales(), { wrapper: createWrapper() });
    queryClient.setQueryData(["sale-details", 2117], { id: 2117 });

    act(() => result.current.setSaleToCancel({ id: 2117, createdAt: "2026-09-28T19:01:00", total: 1 }));
    await act(() => result.current.handleCancelSale("lançada em duplicidade"));

    expect(cancelSaleMock).toHaveBeenCalledWith(2117, "lançada em duplicidade");
    expect(queryClient.getQueryData(["sale-details", 2117])).toBeUndefined();
    expect(result.current.saleToCancel).toBeNull();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: "Venda cancelada." }));
  });

  it("cancelar venda de mês fechado avisa antes e no toast; de mês aberto, não (06/10/2026)", async () => {
    vi.mocked(useGetFinancialClosings).mockReturnValue({
      data: { data: [{ id: 3, periodStart: "2026-09-01T00:00:00", periodEnd: "2026-09-30T00:00:00" }] },
    } as unknown as ReturnType<typeof useGetFinancialClosings>);
    const { result } = renderHook(() => useSales(), { wrapper: createWrapper() });

    act(() => result.current.setSaleToCancel({ id: 2114, createdAt: "2026-10-01T20:58:00", total: 15 }));
    expect(result.current.cancelClosedPeriodNotice).toBeNull();

    act(() => result.current.setSaleToCancel({ id: 2117, createdAt: "2026-09-28T19:01:00", total: 1 }));
    expect(result.current.cancelClosedPeriodNotice).toContain("de 01/09/2026 a 30/09/2026");

    await act(() => result.current.handleCancelSale("lançada em duplicidade"));
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Venda cancelada.",
        description: expect.stringContaining("desatualizado"),
      }),
    );
  });

  it("recusa do servidor no cancelamento vira toast, e o diálogo fica aberto", async () => {
    cancelSaleMock.mockRejectedValueOnce(new Error("Esta venda já está cancelada!"));
    const { result } = renderHook(() => useSales(), { wrapper: createWrapper() });

    act(() => result.current.setSaleToCancel({ id: 2117, createdAt: "2026-09-28T19:01:00", total: 1 }));
    await act(() => result.current.handleCancelSale("cliente desistiu"));

    expect(result.current.saleToCancel).not.toBeNull();
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});

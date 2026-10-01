import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGetCustomersQueryKey,
  getLoyaltyDashboardQueryKey,
  getLoyaltyStatementQueryKey,
  getLoyaltySummaryQueryKey,
  type CustomerSummaryDto,
} from "@workspace/api-client-react";
import { useCustomerLoyalty } from "../useCustomerLoyalty";

const mocks = vi.hoisted(() => ({
  useGetLoyaltyStatement: vi.fn(),
  useGetCompanySettings: vi.fn(),
  adjustLoyaltyStamps: vi.fn(),
  printLoyaltyStatement: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetLoyaltyStatement: mocks.useGetLoyaltyStatement,
  useGetCompanySettings: mocks.useGetCompanySettings,
  adjustLoyaltyStamps: mocks.adjustLoyaltyStamps,
}));

vi.mock("@workspace/receipt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/receipt")>()),
  printLoyaltyStatement: mocks.printLoyaltyStatement,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const customer = { id: 7, name: "Ana" } as CustomerSummaryDto;

const statement = {
  customerId: 7,
  customerName: "Ana",
  card: { stamps: 3, stampsRequired: 10, middleStamp: 5, expiresAt: "2027-10-01T23:59:59" },
  stamps: [
    { position: 1, points: 1, occurredAt: "2026-10-01T10:00:00", kind: "Bonus" },
    { position: 2, points: 1, occurredAt: "2026-10-01T10:00:00", kind: "Purchase" },
    {
      position: 3,
      points: 1,
      occurredAt: "2026-10-02T10:00:00",
      kind: "Adjustment",
      reason: "Venda sem cliente",
    },
  ],
  rewards: [],
};

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { invalidate, ...renderHook(() => useCustomerLoyalty(), { wrapper }) };
}

describe("useCustomerLoyalty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetLoyaltyStatement.mockReturnValue({ data: statement, isLoading: false });
    mocks.useGetCompanySettings.mockReturnValue({ data: undefined });
    mocks.adjustLoyaltyStamps.mockResolvedValue({ card: { stamps: 4, stampsRequired: 10 } });
  });

  it("fechado, não busca extrato nem dados da loja", () => {
    setup();

    expect(mocks.useGetLoyaltyStatement).toHaveBeenLastCalledWith(null, expect.anything());
    expect(mocks.useGetCompanySettings).toHaveBeenLastCalledWith({ query: { enabled: false } });
  });

  it("abrir busca o extrato daquele cliente", () => {
    const { result } = setup();

    act(() => result.current.open(customer));

    expect(result.current.customer?.id).toBe(7);
    expect(mocks.useGetLoyaltyStatement).toHaveBeenLastCalledWith(7, expect.anything());
  });

  it("o ajuste vai com o motivo e atualiza extrato, lista de clientes e painel", async () => {
    const { result, invalidate } = setup();
    act(() => result.current.open(customer));

    await act(() => result.current.adjust(1, "Venda sem cliente"));

    expect(mocks.adjustLoyaltyStamps).toHaveBeenCalledWith(7, { points: 1, reason: "Venda sem cliente" });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        getLoyaltyStatementQueryKey(),
        getGetCustomersQueryKey(),
        getLoyaltyDashboardQueryKey(),
        getLoyaltySummaryQueryKey(),
      ]),
    );
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Ajuste gravado", description: "Saldo: 4 de 10 carimbos." }),
    );
  });

  it("recusa do servidor vira toast com a frase dele e a promessa rejeita", async () => {
    mocks.adjustLoyaltyStamps.mockRejectedValue(new Error("O cliente tem 2 carimbos; não dá para tirar 3."));
    const { result } = setup();
    act(() => result.current.open(customer));

    await expect(act(() => result.current.adjust(-3, "Erro"))).rejects.toThrow();

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining("não dá para tirar 3"),
          variant: "destructive",
        }),
      ),
    );
  });

  it("imprime o extrato no formato do caixa, com o extra marcado", () => {
    const { result } = setup();
    act(() => result.current.open(customer));

    act(() => result.current.print());

    const receipt = mocks.printLoyaltyStatement.mock.calls[0][0];
    expect(receipt.customerName).toBe("Ana");
    expect(receipt.stampsRequired).toBe(10);
    expect(receipt.stamps.map((stamp: { bonus: boolean }) => stamp.bonus)).toEqual([true, false, false]);
    expect(receipt.stamps[2]).toMatchObject({ adjustment: true, points: 1, reason: "Venda sem cliente" });
    expect(receipt.store.storeName).toBeTruthy();
  });
});

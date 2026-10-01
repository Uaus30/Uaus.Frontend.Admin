import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLoyalty } from "../useLoyalty";

const mocks = vi.hoisted(() => ({
  useGetLoyaltySettings: vi.fn(),
  useGetLoyaltySummary: vi.fn(),
  useGetCoupons: vi.fn(),
  turnOnLoyalty: vi.fn(),
  turnOffLoyalty: vi.fn(),
  updateLoyaltySettings: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetLoyaltySettings: mocks.useGetLoyaltySettings,
  useGetLoyaltySummary: mocks.useGetLoyaltySummary,
  useGetCoupons: mocks.useGetCoupons,
  turnOnLoyalty: mocks.turnOnLoyalty,
  turnOffLoyalty: mocks.turnOffLoyalty,
  updateLoyaltySettings: mocks.updateLoyaltySettings,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe("useLoyalty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetLoyaltySettings.mockReturnValue({
      data: { isActive: false, turnOnBlockers: [] },
      isLoading: false,
    });
    mocks.useGetLoyaltySummary.mockReturnValue({ data: undefined, isLoading: true });
    mocks.useGetCoupons.mockReturnValue({ data: { data: [] } });
    mocks.turnOnLoyalty.mockResolvedValue({ isActive: true });
    mocks.turnOffLoyalty.mockResolvedValue({ isActive: false });
  });

  it("abre em todo o período, sem datas", () => {
    renderHook(() => useLoyalty(), { wrapper });

    expect(mocks.useGetLoyaltySummary).toHaveBeenLastCalledWith({});
  });

  it("trocar o período pede os números com as datas do atalho", () => {
    const { result } = renderHook(() => useLoyalty(), { wrapper });

    act(() => result.current.setPreset("this-month"));

    const period = mocks.useGetLoyaltySummary.mock.calls.at(-1)?.[0];
    expect(period).toHaveProperty("from");
    expect(period).toHaveProperty("to");
  });

  it("só busca os cupons do modal com ele aberto", () => {
    const { result } = renderHook(() => useLoyalty(), { wrapper });
    expect(mocks.useGetCoupons.mock.calls.at(-1)?.[1]).toEqual({ query: { enabled: false } });

    act(() => result.current.setConfigOpen(true));

    expect(mocks.useGetCoupons.mock.calls.at(-1)?.[1]).toEqual({ query: { enabled: true } });
  });

  it("ligar avisa que as vendas passam a carimbar", async () => {
    const { result } = renderHook(() => useLoyalty(), { wrapper });

    act(() => result.current.turnOn());

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Programa ligado" })),
    );
  });

  it("desligar fecha a confirmação e avisa que o conquistado fica guardado", async () => {
    const { result } = renderHook(() => useLoyalty(), { wrapper });
    act(() => result.current.setConfirmOffOpen(true));

    await act(() => result.current.turnOff());

    expect(result.current.confirmOffOpen).toBe(false);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Programa desligado" }));
  });

  it("recusa do servidor ao ligar vira toast com a frase dele", async () => {
    mocks.turnOnLoyalty.mockRejectedValue(new Error("Ainda não dá para ligar o programa: Associe um cupom."));
    const { result } = renderHook(() => useLoyalty(), { wrapper });

    act(() => result.current.turnOn());

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining("Associe um cupom"),
          variant: "destructive",
        }),
      ),
    );
  });
});

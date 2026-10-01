import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useLoyalty } from "../useLoyalty";

const mocks = vi.hoisted(() => ({
  useGetLoyaltySettings: vi.fn(),
  useGetLoyaltySummary: vi.fn(),
  useGetCoupons: vi.fn(),
  useGetLoyaltyCharts: vi.fn(),
  useGetLoyaltyActionCounts: vi.fn(),
  useGetLoyaltyActionList: vi.fn(),
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
  useGetLoyaltyCharts: mocks.useGetLoyaltyCharts,
  useGetLoyaltyActionCounts: mocks.useGetLoyaltyActionCounts,
  useGetLoyaltyActionList: mocks.useGetLoyaltyActionList,
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
    mocks.useGetLoyaltyCharts.mockReturnValue({ data: undefined, isLoading: true });
    mocks.useGetLoyaltyActionCounts.mockReturnValue({ data: undefined, isLoading: true });
    mocks.useGetLoyaltyActionList.mockReturnValue({ data: undefined, isLoading: false });
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

  it('os gráficos seguem o período; o "Para agir" é retrato de hoje', () => {
    const { result } = renderHook(() => useLoyalty(), { wrapper });

    act(() => result.current.setPreset("this-month"));

    expect(mocks.useGetLoyaltyCharts).toHaveBeenLastCalledWith(
      mocks.useGetLoyaltySummary.mock.calls.at(-1)?.[0],
    );
    expect(mocks.useGetLoyaltyActionCounts).toHaveBeenLastCalledWith();
  });

  it('só busca a lista de um número do "Para agir" quando ela é aberta', () => {
    const { result } = renderHook(() => useLoyalty(), { wrapper });
    expect(mocks.useGetLoyaltyActionList).toHaveBeenLastCalledWith(null, undefined);

    act(() => result.current.setOpenAction("one-away"));

    expect(mocks.useGetLoyaltyActionList).toHaveBeenLastCalledWith("one-away", undefined);
  });

  it("o filtro de situação vale só na lista de prêmios, e cada abertura volta aos disponíveis", () => {
    const { result } = renderHook(() => useLoyalty(), { wrapper });

    act(() => result.current.setOpenAction("rewards-waiting"));
    expect(mocks.useGetLoyaltyActionList).toHaveBeenLastCalledWith("rewards-waiting", "available");

    act(() => result.current.setRewardStatus("redeemed"));
    expect(mocks.useGetLoyaltyActionList).toHaveBeenLastCalledWith("rewards-waiting", "redeemed");

    act(() => result.current.setOpenAction(null));
    act(() => result.current.setOpenAction("rewards-waiting"));
    expect(mocks.useGetLoyaltyActionList).toHaveBeenLastCalledWith("rewards-waiting", "available");
  });

  it("erro na configuração vira o aviso da página, com tentar de novo", () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mocks.useGetLoyaltySettings.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    });
    const { result } = renderHook(() => useLoyalty(), { wrapper });

    expect(result.current.isSettingsError).toBe(true);
    result.current.retrySettings();
    expect(refetch).toHaveBeenCalled();
  });

  it("erro numa consulta do painel aparece e pode ser refeito", () => {
    const refetch = vi.fn().mockResolvedValue(undefined);
    mocks.useGetLoyaltyCharts.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    const { result } = renderHook(() => useLoyalty(), { wrapper });

    expect(result.current.isChartsError).toBe(true);
    result.current.retryCharts();
    expect(refetch).toHaveBeenCalled();
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

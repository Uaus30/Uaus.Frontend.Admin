import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { CHAMPIONS_DAYS, useChampions } from "../useChampions";

const getDashboardChampions = vi.fn();

vi.mock("@/features/dashboard/api", () => ({
  getDashboardChampions: (...args: unknown[]) => getDashboardChampions(...args),
}));

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function response(hasMore: boolean) {
  return {
    startDate: "2026-09-05T00:00:00",
    endDate: "2026-10-04T00:00:00",
    days: 30,
    totalRevenue: 0,
    totalProfit: 0,
    totalProducts: 0,
    hasMore,
    products: [],
  };
}

describe("useChampions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("abre com o top 10 dos últimos 30 dias", async () => {
    getDashboardChampions.mockResolvedValue(response(true));
    const { result } = renderHook(() => useChampions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.champions).toBeDefined());
    expect(getDashboardChampions).toHaveBeenCalledWith({ days: CHAMPIONS_DAYS, take: 10 });
    expect(result.current.canShowMore).toBe(true);
    expect(result.current.canShowLess).toBe(false);
  });

  it("Ver mais pede mais dez, e Ver menos volta ao top 10", async () => {
    getDashboardChampions.mockResolvedValue(response(true));
    const { result } = renderHook(() => useChampions(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.champions).toBeDefined());

    act(() => result.current.showMore());
    await waitFor(() => expect(getDashboardChampions).toHaveBeenLastCalledWith({ days: 30, take: 20 }));
    expect(result.current.canShowLess).toBe(true);

    act(() => result.current.showLess());
    expect(result.current.take).toBe(10);
  });

  it("esconde o Ver mais quando não há mais produtos", async () => {
    getDashboardChampions.mockResolvedValue(response(false));
    const { result } = renderHook(() => useChampions(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.champions).toBeDefined());
    expect(result.current.canShowMore).toBe(false);
  });
});

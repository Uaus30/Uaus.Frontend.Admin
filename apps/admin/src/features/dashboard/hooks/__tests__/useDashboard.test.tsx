import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useDashboard } from "../useDashboard";

const getDashboardOverview = vi.fn();

vi.mock("@/features/dashboard/api", () => ({
  getDashboardOverview: (...args: unknown[]) => getDashboardOverview(...args),
}));

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

/**
 * `yyyy-MM-dd` de uma data deslocada em dias a partir de hoje, no fuso local.
 *
 * O teste monta a data assim de propósito: `toISOString()` devolveria UTC e o
 * recorte enviado à API sairia deslocado (ver `docs/fuso-horario.md`).
 */
function localDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

describe("useDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDashboardOverview.mockResolvedValue({
      current: {},
      previous: {},
      series: [],
      byCategory: [],
      byPaymentMethod: [],
      topProducts: [],
    });
  });

  it("abre no mês corrente, do dia 1 até hoje", async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: createWrapper() });

    expect(result.current.periodMode).toBe("preset");
    expect(result.current.preset).toBe("month");
    expect(result.current.period.startDate).toBe(`${localDate(0).slice(0, 8)}01`);
    expect(result.current.period.endDate).toBe(localDate(0));

    await waitFor(() => expect(getDashboardOverview).toHaveBeenCalled());
  });

  it("pede ao backend a base dos mesmos dias da semana, semanas antes", async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: createWrapper() });

    await waitFor(() => expect(getDashboardOverview).toHaveBeenCalled());

    const shift = Math.max(4, Math.ceil(new Date().getDate() / 7)) * 7;
    expect(getDashboardOverview).toHaveBeenLastCalledWith({
      startDate: result.current.period.startDate,
      endDate: localDate(0),
      compareStartDate: result.current.comparison.startDate,
      compareEndDate: localDate(-shift),
    });
  });

  it("consulta a API com o intervalo do período selecionado", async () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: createWrapper() });

    await waitFor(() => expect(getDashboardOverview).toHaveBeenCalled());
    act(() => result.current.handleSelectPreset("30d"));

    // A base é o período imediatamente anterior, de mesma duração.
    await waitFor(() =>
      expect(getDashboardOverview).toHaveBeenLastCalledWith({
        startDate: localDate(-29),
        endDate: localDate(0),
        compareStartDate: localDate(-59),
        compareEndDate: localDate(-30),
      }),
    );
  });

  it("aplica o intervalo personalizado com as datas recebidas", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: createWrapper() });

    // O calendário fecha as duas pontas na mesma interação, então as datas vêm
    // por parâmetro: ler o estado aqui pegaria o valor anterior.
    act(() => result.current.handleApplyCustom("2026-01-05", "2026-01-20"));

    expect(result.current.periodMode).toBe("custom");
    expect(result.current.period.startDate).toBe("2026-01-05");
    expect(result.current.period.endDate).toBe("2026-01-20");
    expect(result.current.period.label).toBe("05/01/2026 até 20/01/2026");
  });

  it("ignora um intervalo personalizado incompleto", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: createWrapper() });

    act(() => result.current.handleApplyCustom("2026-01-05", ""));

    expect(result.current.periodMode).toBe("preset");
    expect(result.current.preset).toBe("month");
  });

  it("volta ao preset ao limpar o intervalo personalizado", () => {
    const { result } = renderHook(() => useDashboard(), { wrapper: createWrapper() });

    act(() => result.current.handleApplyCustom("2026-01-05", "2026-01-20"));
    act(() => result.current.handleClearCustom());

    expect(result.current.periodMode).toBe("preset");
    expect(result.current.customStart).toBe("");
    expect(result.current.period.endDate).toBe(localDate(0));
    expect(result.current.period.startDate).toBe(`${localDate(0).slice(0, 8)}01`);
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@workspace/ui";
import { MonthHeatmap } from "../components/MonthHeatmap";
import type { DailyReference, DashboardMonthly, MonthSummary } from "../types";

/** Mês com faturamento por dia; dias depois de `lastHappened` ainda não aconteceram. */
function month(year: number, monthNumber: number, revenue: number, lastHappened?: number): MonthSummary {
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const mm = String(monthNumber).padStart(2, "0");
  return {
    year,
    month: monthNumber,
    label: `${monthNumber}/${year}`,
    startDate: `${year}-${mm}-01T00:00:00`,
    endDate: `${year}-${mm}-${daysInMonth}T00:00:00`,
    daysElapsed: lastHappened ?? daysInMonth,
    daysInMonth,
    isCurrentMonth: lastHappened !== undefined,
    revenue: 0,
    profit: 0,
    discount: 0,
    salesCount: 0,
    itemsCount: 0,
    averageTicket: 0,
    marginPercentage: 0,
    dailyAverageRevenue: 0,
    days: Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      revenue,
      profit: revenue / 2,
      accumulatedRevenue: 0,
      accumulatedProfit: 0,
      salesCount: 2,
      hasHappened: lastHappened === undefined || index + 1 <= lastHappened,
    })),
  };
}

const reference: DailyReference = {
  startDate: "2026-07-01T00:00:00",
  endDate: "2026-09-30T00:00:00",
  daysWithSales: 70,
  averageRevenue: 300,
  weekdays: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    daysWithSales: 12,
    averageRevenue: 300,
  })),
};

const monthly = {
  currentMonth: month(2026, 10, 320, 6),
  previousMonth: month(2026, 9, 280),
  reference,
} as unknown as DashboardMonthly;

function naLargura(largura: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: largura });
}

const larguraOriginal = window.innerWidth;

function renderHeatmap() {
  render(
    <TooltipProvider>
      <MonthHeatmap monthly={monthly} isLoading={false} />
    </TooltipProvider>,
  );
}

describe("MonthHeatmap — no celular (06/10/2026)", () => {
  beforeEach(() => {
    // Terça, 06/10/2026: o dia de hoje no calendário.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    naLargura(larguraOriginal);
  });

  it("abre o painel no dia de hoje e troca para o dia tocado — a dica do hover não abre no toque", () => {
    naLargura(375);
    renderHeatmap();

    const painel = screen.getByTestId("heat-day-panel");
    expect(within(painel).getByText(/Terça, 06\/10/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /^Segunda, 05\/10/ }));

    expect(within(screen.getByTestId("heat-day-panel")).getByText(/Segunda, 05\/10/)).toBeTruthy();
  });

  it("tira a coluna Semana (o total vem no painel) para as sete colunas caberem", () => {
    naLargura(375);
    renderHeatmap();

    expect(screen.queryByText("Semana")).toBeNull();
    expect(within(screen.getByTestId("heat-day-panel")).getByText(/^Semana:/)).toBeTruthy();
  });

  it("no computador nada muda: coluna Semana e nenhum painel aberto sozinho", () => {
    naLargura(1280);
    renderHeatmap();

    expect(screen.getByText("Semana")).toBeTruthy();
    expect(screen.queryByTestId("heat-day-panel")).toBeNull();
  });
});

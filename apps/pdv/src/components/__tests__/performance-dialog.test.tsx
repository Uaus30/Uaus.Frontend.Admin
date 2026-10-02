import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useGetStorePerformance: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStorePerformance: mocks.useGetStorePerformance,
}));

// O gráfico mede a tela (recharts); aqui interessa só o texto da modal.
vi.mock("../weekday-comparison-chart", () => ({ WeekdayComparisonChart: () => null }));

const { PerformanceDialog } = await import("../performance-dialog");

mocks.useGetStorePerformance.mockReturnValue({
  isLoading: false,
  error: null,
  data: {
    referenceDate: "2026-10-01",
    serverTime: "2026-10-01T20:00:00",
    today: { revenue: 300, salesCount: 13, averageTicket: 23.07 },
    weekdayComparison: [],
    week: { revenue: 1200 },
    month: { revenue: 5000 },
  },
});

describe("Desempenho", () => {
  it("mostra as vendas com cliente identificado, que saíram do carrinho", () => {
    render(
      <PerformanceDialog
        open
        onOpenChange={vi.fn()}
        identifiedSales={{ identified: 4, total: 13 }}
        identifiedPeriodLabel="Neste turno"
      />,
    );

    expect(screen.getByText(/vendas com cliente/).textContent).toBe(
      "Neste turno: 4 de 13 vendas com cliente identificado",
    );
  });

  it("sem venda no período, não mostra o contador", () => {
    render(<PerformanceDialog open onOpenChange={vi.fn()} identifiedSales={{ identified: 0, total: 0 }} />);

    expect(screen.queryByText(/vendas com cliente/)).toBeNull();
  });
});

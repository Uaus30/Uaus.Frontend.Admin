import type { ReactElement } from "react";
import { render as renderBase, screen } from "@testing-library/react";
import { TooltipProvider } from "@workspace/ui";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useGetStorePerformance: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStorePerformance: mocks.useGetStorePerformance,
}));

const { PerformanceDialog } = await import("../performance-dialog");

/** As barras do gráfico por hora têm dica, que exige o provider do `App.tsx`. */
function render(ui: ReactElement) {
  return renderBase(<TooltipProvider>{ui}</TooltipProvider>);
}

mocks.useGetStorePerformance.mockReturnValue({
  isLoading: false,
  error: null,
  data: {
    referenceDate: "2026-10-01",
    serverTime: "2026-10-01T20:00:00",
    today: { revenue: 300, salesCount: 13, averageTicket: 23.07 },
    weekdayComparison: [],
    hours: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      revenue: hour === 9 ? 120 : hour === 14 ? 180 : 0,
      salesCount: hour === 9 ? 5 : hour === 14 ? 8 : 0,
    })),
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

  it("mostra o faturamento de hoje por hora, até a hora atual", () => {
    render(<PerformanceDialog open onOpenChange={vi.fn()} />);

    expect(screen.getByText("Faturamento por hora")).toBeTruthy();
    // Das 8h (abertura) até as 20h do relógio do servidor.
    expect(screen.getByText("08h")).toBeTruthy();
    expect(screen.getByText("20h")).toBeTruthy();
    expect(screen.queryByText("Semana atual x anterior")).toBeNull();
  });

  it("sem venda no período, não mostra o contador", () => {
    render(<PerformanceDialog open onOpenChange={vi.fn()} identifiedSales={{ identified: 0, total: 0 }} />);

    expect(screen.queryByText(/vendas com cliente/)).toBeNull();
  });
});

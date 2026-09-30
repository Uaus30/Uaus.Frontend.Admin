import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LowStockSummaryDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({ useGetLowStockSummary: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetLowStockSummary: mocks.useGetLowStockSummary,
}));

const { LowStockAlert } = await import("../LowStockAlert");
const { LOW_STOCK_REPORT_PATH } = await import("../../low-stock-route");

function givenSummary(summary: Partial<LowStockSummaryDto>) {
  mocks.useGetLowStockSummary.mockReturnValue({ data: { restock: 0, ...summary } });
}

describe("LowStockAlert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("conta quem precisa de reposicao, o mesmo numero do relatorio", () => {
    // Desde 29/09/2026 o parado ja nao chega a lista (giro baixo sai sozinho),
    // e o alerta conta o mesmo que o relatorio sem filtro.
    givenSummary({ restock: 4 });
    render(<LowStockAlert />);

    expect(screen.getByTestId("low-stock-alert").textContent).toContain("Existem 4 produtos para repor");
  });

  it("nao aparece sem produto para repor", () => {
    // Alerta sempre aceso ensina a ser ignorado.
    givenSummary({ restock: 0 });
    const { container } = render(<LowStockAlert />);

    expect(container.innerHTML).toBe("");
  });

  it("leva ao relatorio SEM filtro", () => {
    // Desde 29/09/2026 a contagem e o mesmo numero do relatorio sem filtro.
    givenSummary({ restock: 2 });
    render(<LowStockAlert />);

    expect(screen.getByTestId("low-stock-alert").getAttribute("href")).toBe(LOW_STOCK_REPORT_PATH);
  });

  it("fala no singular com um produto so", () => {
    givenSummary({ restock: 1 });
    render(<LowStockAlert variant="compact" />);

    expect(screen.getByTestId("low-stock-alert").textContent).toContain("1 produto para repor");
  });

  it("diz as tres portas do relatorio", () => {
    givenSummary({ restock: 7 });
    render(<LowStockAlert />);

    const texto = screen.getByTestId("low-stock-alert").textContent ?? "";
    expect(texto).toContain(
      "7 produtos para repor: esgotados, com menos de 30 dias de estoque ou no estoque mínimo",
    );
    expect(texto).toContain("Acesse o relatório para visualizar os detalhes");
  });
});

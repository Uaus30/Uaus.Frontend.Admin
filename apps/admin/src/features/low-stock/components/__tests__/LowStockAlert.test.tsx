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
  mocks.useGetLowStockSummary.mockReturnValue({
    data: { pending: 0, resolved: 0, restock: 0, restockMinSales: 3, ...summary },
  });
}

describe("LowStockAlert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("conta quem VENDE e esta acabando, nao quem so esta abaixo do minimo", () => {
    // A distincao e a razao de ser da mudanca: o alerta antigo acendia para
    // produto parado ha um ano, que nao e urgencia de reposicao.
    givenSummary({ pending: 12, restock: 4 });
    render(<LowStockAlert />);

    const alerta = screen.getByTestId("low-stock-alert");
    expect(alerta.textContent).toContain("4 produtos com boa saída e pouco estoque");
    expect(alerta.textContent).not.toContain("12");
  });

  it("nao aparece sem produto para repor, mesmo com pendencia no relatorio", () => {
    // Alerta sempre aceso ensina a ser ignorado.
    givenSummary({ pending: 30, restock: 0 });
    const { container } = render(<LowStockAlert />);

    expect(container.innerHTML).toBe("");
  });

  it("leva ao relatorio JA filtrado pelo minimo de vendas do backend", () => {
    // O filtro vem na URL para a tela abrir com a mesma pergunta que o alerta
    // fez; o numero e o do backend, nao um repetido aqui.
    givenSummary({ restock: 2, restockMinSales: 5 });
    render(<LowStockAlert />);

    expect(screen.getByTestId("low-stock-alert").getAttribute("href")).toBe(
      `${LOW_STOCK_REPORT_PATH}?vendas=5`,
    );
  });

  it("fala no singular com um produto so", () => {
    givenSummary({ restock: 1 });
    render(<LowStockAlert variant="compact" />);

    expect(screen.getByTestId("low-stock-alert").textContent).toContain(
      "1 produto com boa saída e pouco estoque",
    );
  });
});

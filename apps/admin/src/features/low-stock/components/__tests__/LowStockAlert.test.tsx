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
    data: { restock: 0, restockMinSales: 3, ...summary },
  });
}

describe("LowStockAlert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("conta quem VENDE e esta acabando", () => {
    // A distincao e a razao de ser da mudanca: o alerta antigo acendia para
    // produto parado ha um ano, que nao e urgencia de reposicao.
    givenSummary({ restock: 4 });
    render(<LowStockAlert />);

    expect(screen.getByTestId("low-stock-alert").textContent).toContain(
      "Existem 4 produtos com boa saída nos últimos 30 dias e pouco estoque",
    );
  });

  it("nao aparece sem produto para repor", () => {
    // Alerta sempre aceso ensina a ser ignorado.
    givenSummary({ restock: 0 });
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

  it("a janela de 30 dias qualifica a SAIDA, nao o estoque", () => {
    // Grudadas, as duas condicoes liam como se o estoque tambem fosse dos 30
    // dias. Separadas, cada uma diz o que e.
    givenSummary({ restock: 7 });
    render(<LowStockAlert />);

    const texto = screen.getByTestId("low-stock-alert").textContent ?? "";
    expect(texto).toContain("boa saída nos últimos 30 dias e pouco estoque");
    expect(texto).toContain("Acesse o relatório para visualizar os detalhes");
  });
});

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

  it("conta quem VENDEU no mes e esta esgotado ou acabando", () => {
    // A distincao e a razao de ser da contagem: o alerta antigo acendia para
    // produto parado ha um ano, que nao e urgencia de reposicao.
    givenSummary({ restock: 4 });
    render(<LowStockAlert />);

    expect(screen.getByTestId("low-stock-alert").textContent).toContain(
      "Existem 4 produtos com venda nos últimos 30 dias esgotados ou com menos de 30 dias de estoque",
    );
  });

  it("nao aparece sem produto para repor", () => {
    // Alerta sempre aceso ensina a ser ignorado.
    givenSummary({ restock: 0 });
    const { container } = render(<LowStockAlert />);

    expect(container.innerHTML).toBe("");
  });

  it("leva ao relatorio SEM filtro", () => {
    // A contagem e um subconjunto do relatorio: filtrar a lista para "bater"
    // com o numero esconderia o resto do que precisa de compra, e o que o
    // alerta conta aparece no topo de qualquer jeito — a lista ordena pelo que
    // acaba antes.
    givenSummary({ restock: 2 });
    render(<LowStockAlert />);

    expect(screen.getByTestId("low-stock-alert").getAttribute("href")).toBe(LOW_STOCK_REPORT_PATH);
  });

  it("fala no singular com um produto so", () => {
    givenSummary({ restock: 1 });
    render(<LowStockAlert variant="compact" />);

    expect(screen.getByTestId("low-stock-alert").textContent).toContain("1 produto vendendo e acabando");
  });

  it("a janela de 30 dias qualifica a VENDA, nao o estoque", () => {
    // Grudadas, as duas condicoes liam como se o estoque tambem fosse dos 30
    // dias. Separadas, cada uma diz o que e.
    givenSummary({ restock: 7 });
    render(<LowStockAlert />);

    const texto = screen.getByTestId("low-stock-alert").textContent ?? "";
    expect(texto).toContain("com venda nos últimos 30 dias esgotados ou com menos de 30 dias de estoque");
    expect(texto).toContain("Acesse o relatório para visualizar os detalhes");
  });
});

import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { STOREFRONT_STOCK_BADGE } from "@workspace/api-client-react";
import { StockBadge } from "../StockBadge";

afterEach(() => cleanup());

describe("StockBadge", () => {
  it("pinta 'Últimas unidades' e 'Último disponível' pelo nome do enum, como o backend serializa", () => {
    render(<StockBadge badge="LastUnits" />);
    expect(screen.getByText("Últimas unidades")).toBeTruthy();
    cleanup();

    render(<StockBadge badge="LastUnit" />);
    expect(screen.getByText("Último disponível")).toBeTruthy();
  });

  it("aceita também o código numérico", () => {
    render(<StockBadge badge={STOREFRONT_STOCK_BADGE.LastUnit} />);

    expect(screen.getByText("Último disponível")).toBeTruthy();
  });

  it("não renderiza nada sem tag — nem para backend anterior ao campo", () => {
    // `None`, ausente e lixo: os três são "sem tag". Um selo vazio no canto do
    // card seria pior que nenhum.
    render(<StockBadge badge="None" />);
    expect(screen.queryByTestId("stock-badge")).toBeNull();

    render(<StockBadge badge={undefined} />);
    expect(screen.queryByTestId("stock-badge")).toBeNull();

    render(<StockBadge badge="Qualquer" />);
    expect(screen.queryByTestId("stock-badge")).toBeNull();
  });
});

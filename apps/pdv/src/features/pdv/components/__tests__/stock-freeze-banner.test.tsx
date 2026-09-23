import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StockFreezeBanner } from "../stock-freeze-banner";

describe("StockFreezeBanner (PDV)", () => {
  it("diz ao operador o que está pausado e onde se resolve", () => {
    render(<StockFreezeBanner salesPaused />);

    expect(screen.getByRole("status").textContent).toBe(
      "Conferência de estoque em andamento — vendas e baixas pausadas até ela ser encerrada no admin.",
    );
  });

  it("some sem conferência aberta", () => {
    render(<StockFreezeBanner salesPaused={false} />);

    expect(screen.queryByRole("status")).toBeNull();
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RestockList } from "../components/RestockList";
import type { RestockSuggestion } from "../types";

const sugestao: RestockSuggestion = {
  productId: 7,
  productName: "VELA AROMÁTICA",
  barcode: "789",
  categoryName: "Casa",
  supplierName: "Shopee",
  stock: 2,
  minStock: 3,
  price: 20,
  costPrice: 8,
  marginPercentage: 60,
  quantitySold: 30,
  revenue: 600,
  profit: 360,
  averageDailySales: 1.25,
  daysOfCover: 1.6,
  profitPerDay: 12,
  score: 120,
  urgency: "critical",
  suggestedPurchaseQuantity: 12,
};

describe("RestockList — no celular (06/10/2026)", () => {
  it("o resumo embaixo do nome traz o que as colunas escondidas mostravam", () => {
    // Abaixo do `lg` saem urgência, estoque, cobertura, venda/dia, margem e
    // lucro em risco; tudo isso vem no resumo, para nada sumir no celular.
    render(<RestockList items={[sugestao]} lookbackDays={30} />);

    const resumo = screen.getByText("VELA AROMÁTICA").parentElement!.querySelector(".lg\\:hidden")!;
    expect(resumo.textContent).toContain("estoque 2 / 3");
    expect(resumo.textContent).toContain("1,25 por dia");
    expect(resumo.textContent).toContain("margem 60,0%");
    expect(resumo.textContent).toContain("em risco");
  });
});

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CatalogPieceDto } from "@workspace/api-client-react";
import { CatalogHistoryList } from "../CatalogHistoryList";

/** Peças como a API manda: enum pelo nome, nulo omitido. */
const pieces: CatalogPieceDto[] = [
  {
    id: 2,
    sharedAt: "2026-10-03T10:30:00",
    sharedBy: "Wagner",
    theme: "Department",
    departmentName: "Brinquedos",
    format: "Pdf",
    title: "Semana das crianças",
    measuredDays: 2,
    isComplete: false,
    unitsBefore: 3,
    unitsAfter: 8,
    items: [
      {
        productGroupId: 10,
        name: "CARRINHO DE FRICÇÃO",
        role: "New",
        price: 15,
        unitsBefore: 1,
        unitsAfter: 6,
      },
      { productGroupId: 11, name: "BOLA DE VINIL", role: "Slow", price: 9.9, unitsBefore: 2, unitsAfter: 2 },
    ],
  },
  {
    id: 1,
    sharedAt: "2026-09-20T09:00:00",
    theme: "General",
    format: "Story",
    title: "Destaques da loja",
    measuredDays: 7,
    isComplete: true,
    unitsBefore: 9,
    unitsAfter: 4,
    items: [
      { productGroupId: 12, name: "POTE 1L", role: "BestSeller", price: 3, unitsBefore: 9, unitsAfter: 4 },
    ],
  },
];

describe("CatalogHistoryList", () => {
  it("cada peça diz o que é: quando saiu, formato, tema, quantos produtos e quem compartilhou", () => {
    render(<CatalogHistoryList pieces={pieces} measureDays={7} />);

    const [nova, antiga] = screen.getAllByRole("listitem");

    expect(within(nova).getByText("Semana das crianças")).toBeTruthy();
    expect(
      within(nova).getByText("03/10/2026, 10:30 · Catálogo em PDF · Brinquedos · 2 produtos · Wagner"),
    ).toBeTruthy();
    // Sem quem compartilhou (usuário excluído), a linha não termina num ponto solto.
    expect(within(antiga).getByText("20/09/2026, 09:00 · Banner 9:16 · Geral · 1 produto")).toBeTruthy();
  });

  it("mostra o antes, o depois e a diferença com sinal", () => {
    render(<CatalogHistoryList pieces={pieces} measureDays={7} />);

    const [nova, antiga] = screen.getAllByRole("listitem");

    expect(within(nova).getByText("3 unidades")).toBeTruthy();
    expect(within(nova).getByText("8 unidades")).toBeTruthy();
    expect(within(nova).getAllByText("+5")).toHaveLength(2); // a peça e o carrinho
    expect(within(antiga).getAllByText("−5")).toHaveLength(2);
  });

  it("a semana pela metade é dita com todas as letras", () => {
    render(<CatalogHistoryList pieces={pieces} measureDays={7} />);

    expect(screen.getByText("Medindo: 2 dias de 7, contra o mesmo trecho da semana anterior.")).toBeTruthy();
    expect(screen.getByText("Semana fechada: 7 dias de cada lado.")).toBeTruthy();
  });

  it("os produtos saem na ordem da peça, com o papel e o preço impresso", () => {
    render(<CatalogHistoryList pieces={pieces} measureDays={7} />);

    const rows = within(screen.getAllByRole("listitem")[0]).getAllByRole("row", { hidden: true }).slice(1);

    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("CARRINHO DE FRICÇÃO")).toBeTruthy();
    expect(within(rows[0]).getByText("Novidade")).toBeTruthy();
    expect(within(rows[0]).getByText(/15,00/)).toBeTruthy();
    expect(within(rows[1]).getByText("Achado")).toBeTruthy();
    // Vendeu igual: nem alta nem queda.
    expect(within(rows[1]).getByText("=")).toBeTruthy();
  });
});

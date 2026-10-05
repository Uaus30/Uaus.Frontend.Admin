import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CatalogProduct } from "../../types";
import { CatalogProductList } from "../CatalogProductList";

function product(id: number): CatalogProduct {
  return {
    productGroupId: id,
    name: `PRODUTO ${id}`,
    price: 10,
    hasPriceRange: false,
    imageUrl: `https://bucket.exemplo/${id}.jpg`,
    role: id === 1 ? "new" : "slow",
  };
}

/** Sem jest-dom aqui: o estado do botão é lido no próprio elemento. */
const button = (element: HTMLElement) => element as HTMLButtonElement;

function renderList(overrides: Partial<Parameters<typeof CatalogProductList>[0]> = {}) {
  const props = {
    products: [1, 2, 3, 4, 5, 6, 7].map(product),
    noun: "catálogo",
    pageSize: 6,
    isGenerating: false,
    selectedIds: [] as number[],
    onToggle: vi.fn(),
    onClearSelection: vi.fn(),
    onSwapSelected: vi.fn(),
    ...overrides,
  };
  render(<CatalogProductList {...props} />);
  return props;
}

describe("CatalogProductList", () => {
  it("sem marcado, o botão de trocar fica desligado", () => {
    renderList();

    expect(button(screen.getByRole("button", { name: /trocar selecionados/i })).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /desmarcar/i })).toBeNull();
  });

  it("tocar na linha marca o produto — não só na caixinha", () => {
    const props = renderList();

    fireEvent.click(screen.getByText("PRODUTO 3"));

    expect(props.onToggle).toHaveBeenCalledWith(3);
  });

  it("com marcados, o botão diz quantos troca e troca todos num toque", () => {
    const props = renderList({ selectedIds: [2, 5] });

    expect(screen.getByRole("checkbox", { name: /PRODUTO 2/ }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("checkbox", { name: /PRODUTO 3/ }).getAttribute("aria-checked")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Trocar 2 produtos" }));
    expect(props.onSwapSelected).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /desmarcar/i }));
    expect(props.onClearSelection).toHaveBeenCalledTimes(1);
  });

  it("marcado que já não está na peça não entra na conta", () => {
    renderList({ selectedIds: [1, 999] });

    expect(button(screen.getByRole("button", { name: "Trocar 1 produto" })).disabled).toBe(false);
  });

  it("durante a geração nada se marca nem se troca", () => {
    const props = renderList({ selectedIds: [2], isGenerating: true });

    fireEvent.click(screen.getByText("PRODUTO 3"));

    expect(props.onToggle).not.toHaveBeenCalled();
    expect(button(screen.getByRole("button", { name: "Trocar 1 produto" })).disabled).toBe(true);
  });

  it("no PDF a linha diz em que página o produto saiu", () => {
    renderList();

    // `getByText` falha sozinho quando o texto não está na tela.
    expect(screen.getByText("Página 2 · Achado").textContent).toBe("Página 2 · Achado");
    expect(screen.getByText("Página 1 · Novidade").textContent).toBe("Página 1 · Novidade");
  });
});

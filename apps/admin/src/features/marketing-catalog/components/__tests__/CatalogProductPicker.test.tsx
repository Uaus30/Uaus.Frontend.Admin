import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CatalogSearchItemDto } from "@workspace/api-client-react";
import { CatalogProductPicker } from "../CatalogProductPicker";

function found(id: number, unavailable = "None"): CatalogSearchItemDto {
  return {
    productGroupId: id,
    name: `PRODUTO ${id}`,
    unavailable,
    card:
      unavailable === "None"
        ? {
            productGroupId: id,
            name: `PRODUTO ${id}`,
            price: 12.5,
            priceMax: id === 2 ? 20 : undefined,
            hasVariations: false,
            categoryName: "Brinquedos",
            tags: [],
          }
        : undefined,
  };
}

/** Sem jest-dom aqui: o estado do botão é lido no próprio elemento. */
const button = (element: HTMLElement) => element as HTMLButtonElement;

function renderPicker(overrides: Partial<Parameters<typeof CatalogProductPicker>[0]> = {}) {
  const props = {
    search: "prod",
    setSearch: vi.fn(),
    onSubmit: vi.fn(),
    onClear: vi.fn(),
    onScanCode: vi.fn(),
    results: [found(1), found(2), found(3, "OutOfStock"), found(4, "NotOnSite")],
    isLoading: false,
    hasSearched: true,
    hasFailed: false,
    selectedIds: [] as number[],
    isFull: false,
    onAdd: vi.fn(() => true),
    ...overrides,
  };
  render(<CatalogProductPicker {...props} />);
  return props;
}

describe("CatalogProductPicker", () => {
  it("antes de buscar não lista nada", () => {
    renderPicker({ hasSearched: false, results: [] });

    expect(screen.getByText(/digite o nome ou o código/i)).toBeTruthy();
  });

  it("quem não pode entrar aparece com o motivo e o + desligado", () => {
    renderPicker();

    expect(screen.getByText("Não entra: sem saldo")).toBeTruthy();
    expect(screen.getByText("Não entra: fora do site")).toBeTruthy();
    expect(button(screen.getByRole("button", { name: "Adicionar PRODUTO 3 ao banner" })).disabled).toBe(true);
    expect(button(screen.getByRole("button", { name: "Adicionar PRODUTO 1 ao banner" })).disabled).toBe(
      false,
    );
  });

  it("mostra o preço do card, com o 'a partir de' das variações", () => {
    renderPicker();

    expect(screen.getByText(/^R\$\s12,50$/)).toBeTruthy();
    expect(screen.getByText(/^a partir de R\$\s12,50$/)).toBeTruthy();
  });

  it("o + adiciona e esvazia a busca; quem já está na lista vira um visto", () => {
    const props = renderPicker({ selectedIds: [2] });

    fireEvent.click(screen.getByRole("button", { name: "Adicionar PRODUTO 1 ao banner" }));

    expect(props.onAdd).toHaveBeenCalledWith(props.results[0]);
    expect(props.onClear).toHaveBeenCalled();
    expect(button(screen.getByRole("button", { name: "PRODUTO 2 já está no banner" })).disabled).toBe(true);
  });

  it("produto que não entrou não esvazia a busca", () => {
    const props = renderPicker({ onAdd: vi.fn(() => false) });

    fireEvent.click(screen.getByRole("button", { name: "Adicionar PRODUTO 1 ao banner" }));

    expect(props.onClear).not.toHaveBeenCalled();
  });

  it("banner cheio desliga todos os +", () => {
    renderPicker({ isFull: true });

    expect(button(screen.getByRole("button", { name: "Adicionar PRODUTO 1 ao banner" })).disabled).toBe(true);
  });

  it("falha da busca não se passa por 'nenhum produto'", () => {
    renderPicker({ hasFailed: true, results: [] });

    expect(screen.getByText(/não foi possível buscar/i)).toBeTruthy();
    expect(screen.queryByText(/nenhum produto encontrado/i)).toBeNull();
  });
});

import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SaleItemsEditor } from "../SaleItemsEditor";

const mocks = vi.hoisted(() => ({
  getProductsPage: vi.fn(() => Promise.resolve({ data: [] })),
}));

vi.mock("@/services/products.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/products.service")>()),
  getProductsPage: mocks.getProductsPage,
}));

describe("SaleItemsEditor — os produtos da Nova venda", () => {
  beforeAll(() => {
    // O Popper do Radix mede o gatilho, e o jsdom não tem ResizeObserver.
    globalThis.ResizeObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    Element.prototype.scrollIntoView ??= () => {};
  });

  it("o item contado depois da data da venda diz quando, e só ele", () => {
    // Decisão do dono (06/10/2026): só o aviso, indicando que o produto teve o
    // estoque alterado depois da data da venda.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const item = (productId: number, name: string) => ({
      productId,
      name,
      stock: 10,
      unitPrice: 1,
      quantity: 1,
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SaleItemsEditor
          items={[item(1, "CANETA BIC [VERMELHA]"), item(2, "CANETA BIC [PRETA]")]}
          onAdd={vi.fn()}
          onUpdate={vi.fn()}
          onRemove={vi.fn()}
          stockCorrections={{ 1: "2026-10-02T09:00:00" }}
        />
      </QueryClientProvider>,
    );

    const avisos = screen.getAllByText(/Estoque corrigido por contagem/);
    expect(avisos).toHaveLength(1);
    expect(avisos[0].textContent).toContain("em 02/10/2026");
    expect(avisos[0].closest("li")?.textContent).toContain("CANETA BIC [VERMELHA]");
  });

  it("a busca de produto pede ao servidor sem o inativo (decisão do dono, 06/10/2026)", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <SaleItemsEditor items={[]} onAdd={vi.fn()} onUpdate={vi.fn()} onRemove={vi.fn()} />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("combobox"));

    await waitFor(() =>
      expect(mocks.getProductsPage).toHaveBeenCalledWith(expect.objectContaining({ excludeInactive: true })),
    );
  });
});

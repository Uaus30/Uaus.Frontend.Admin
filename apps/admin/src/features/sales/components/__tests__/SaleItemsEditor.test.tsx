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

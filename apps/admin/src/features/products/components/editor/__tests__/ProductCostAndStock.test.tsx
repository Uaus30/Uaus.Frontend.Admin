import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatCurrency } from "@workspace/core";

const mocks = vi.hoisted(() => ({ getProductById: vi.fn() }));

vi.mock("@/services/products.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/products.service")>()),
  getProductById: mocks.getProductById,
}));

const { ProductCostAndStock } = await import("../ProductCostAndStock");
const { describeCostAndStock } = await import("../../../lib/costAndStock");

/** O mínimo do editor que o bloco lê. */
function editor(extras: { id?: number | null; hasVariations?: boolean } = {}) {
  return {
    form: { hasVariations: extras.hasVariations ?? false },
    productEditor: { id: extras.id === undefined ? 12 : extras.id },
  } as unknown as Parameters<typeof ProductCostAndStock>[0]["editor"];
}

function renderBlock(extras: Parameters<typeof editor>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ProductCostAndStock editor={editor(extras)} />
    </QueryClientProvider>,
  );
}

const valor = (label: string) => (screen.getByLabelText(label) as HTMLInputElement).value;

describe("describeCostAndStock — o que a tela escreve", () => {
  it("sem entrada nenhuma não há custo nem saldo: '-' nos dois, e não zero", () => {
    expect(describeCostAndStock({ costPrice: 0, stock: 0 })).toEqual({ cost: "-", stock: "-" });
    expect(describeCostAndStock(undefined)).toEqual({ cost: "-", stock: "-" });
  });

  it("com entrada, o custo da última e o saldo — inclusive o zero de quem vendeu tudo", () => {
    expect(describeCostAndStock({ costPrice: 4.5, stock: 7 })).toEqual({
      cost: formatCurrency(4.5),
      stock: "7 un",
    });
    expect(describeCostAndStock({ costPrice: 4.5, stock: 0 }).stock).toBe("0 un");
  });

  it("saldo sem custo (legado sem lote) ainda mostra o saldo", () => {
    expect(describeCostAndStock({ costPrice: 0, stock: 3 })).toEqual({ cost: "-", stock: "3 un" });
  });
});

describe("ProductCostAndStock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mostra o último custo e o estoque atual, só para leitura, lidos do servidor", async () => {
    mocks.getProductById.mockResolvedValue({ id: 12, costPrice: 2, stock: 10 });
    renderBlock();

    // O valor é comparado direto: o `findByDisplayValue` normaliza o espaço
    // não separável do "R$" e deixaria de casar com o que a tela escreve.
    await waitFor(() => expect(valor("Último custo")).toBe(formatCurrency(2)));
    expect(valor("Estoque atual")).toBe("10 un");
    expect(screen.getByLabelText("Último custo").hasAttribute("readonly")).toBe(true);
    expect(mocks.getProductById).toHaveBeenCalledWith(12);
  });

  it("cadastro novo, ainda sem id: '-' e nenhuma consulta", () => {
    renderBlock({ id: null });

    expect(valor("Último custo")).toBe("-");
    expect(valor("Estoque atual")).toBe("-");
    expect(mocks.getProductById).not.toHaveBeenCalled();
  });

  it("some no grupo com variações, como preço e status", () => {
    renderBlock({ hasVariations: true });

    expect(screen.queryByLabelText("Último custo")).toBeNull();
  });
});

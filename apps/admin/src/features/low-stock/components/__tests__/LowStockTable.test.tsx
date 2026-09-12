import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LowStockItemDto } from "@workspace/api-client-react";

const { LowStockTable } = await import("../LowStockTable");

/**
 * Duas linhas que cobrem os dois extremos da coluna "Dura": a esgotada, que não
 * tem previsão a fazer, e a que ainda tem saldo.
 */
const esgotado: LowStockItemDto = {
  productId: 10,
  productGroupId: 1,
  productName: "BEXIGA [AZUL]",
  barcode: "789000000010",
  categoryName: "Balões",
  supplierName: "Shopee",
  supplierId: 13,
  imageUrl: null,
  stock: 0,
  minStock: 0,
  price: 10,
  costPrice: 4,
  lastSaleAt: "2026-09-05T10:00:00",
  recentSales: 12,
  coverWindowSales: 12,
  averageDailySales: 0.13,
  daysOfCover: 0,
  hasOpenPurchase: false,
};

const acabando: LowStockItemDto = {
  ...esgotado,
  productId: 11,
  productName: "VELA",
  barcode: "789000000011",
  stock: 40,
  daysOfCover: 24,
  recentSales: 150,
  coverWindowSales: 150,
  averageDailySales: 1.67,
};

function renderTable(overrides: Partial<Parameters<typeof LowStockTable>[0]> = {}) {
  const props = {
    items: [esgotado, acabando],
    isLoading: false,
    search: "",
    setSearch: vi.fn(),
    maxStock: "",
    setMaxStock: vi.fn(),
    minRecentSales: "",
    setMinRecentSales: vi.fn(),
    sort: "Default" as const,
    onToggleSalesSort: vi.fn(),
    page: 1,
    totalPages: 1,
    setPage: vi.fn(),
    onComprar: vi.fn(),
    onDisableStockControl: vi.fn(),
    onInactivate: vi.fn(),
    mutatingProductId: null,
    ...overrides,
  };

  return { props, ...render(<LowStockTable {...props} />) };
}

describe("LowStockTable", () => {
  afterEach(cleanup);

  it("oferece 'Inativar produto' no menu da linha", async () => {
    // A saída do que esgotou e não se quer repor. Sem ela, a linha volta a cada
    // abertura da tela pedindo uma decisão que já foi tomada.
    const { props } = renderTable();

    fireEvent.pointerDown(
      screen.getByLabelText("Opções de BEXIGA [AZUL]"),
      new PointerEvent("pointerdown", { ctrlKey: false, button: 0 }),
    );

    fireEvent.click(await screen.findByText("Inativar produto"));

    expect(props.onInactivate).toHaveBeenCalledWith(esgotado);
    expect(props.onDisableStockControl).not.toHaveBeenCalled();
  });

  it("esconde fornecedor, saldo e última venda abaixo de 2xl", () => {
    // Com as sete colunas a tabela passa de 1.200px e empurra para fora da tela
    // justamente o botão "Comprar" e o menu. O contrato é o mesmo da tela de
    // Compras: `hidden` + `2xl:table-cell`.
    renderTable();

    for (const rotulo of ["Fornecedor", "Estoque / mín.", "Última venda"]) {
      const coluna = screen.getByText(rotulo).closest("th");
      expect(coluna?.className).toContain("hidden");
      expect(coluna?.className).toContain("2xl:table-cell");
    }

    // As que decidem a compra ficam em qualquer largura.
    expect(screen.getByText("Produto").closest("th")?.className).not.toContain("hidden");
    expect(screen.getByText("Dura").closest("th")?.className).not.toContain("hidden");
  });

  it("diz 'esgotado' em vez de 'acaba hoje' para saldo zero", () => {
    // Com saldo zero não há previsão a fazer: o produto já acabou, e mandar
    // conferir uma data que passou confunde quem decide o que comprar hoje.
    renderTable();

    expect(screen.getByText("esgotado")).toBeTruthy();
    expect(screen.getByText("24 dias")).toBeTruthy();
  });

  it("explica o critério do relatório quando a lista vem vazia", () => {
    renderTable({ items: [] });

    expect(screen.getByText("Nenhum produto precisando de reposição.")).toBeTruthy();
    expect(screen.getByText(/esgotados que venderam no mês, quem atingiu o estoque mínimo/)).toBeTruthy();
  });
});

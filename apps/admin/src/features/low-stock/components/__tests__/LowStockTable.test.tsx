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
  effectiveMinStock: 2,
  stockControlEnabled: true,
  forecastStatus: "Controlled",
  monthlySalesMedian: 4,
  price: 10,
  costPrice: 4,
  lastSaleAt: "2026-09-05T10:00:00",
  recentSales: 12,
  dailyDemand: 0.1333,
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
  dailyDemand: 1.6667,
  averageDailySales: 1.67,
};

/** Desligado à mão, como fim de linha: a aba "Fora do controle". */
const desligado: LowStockItemDto = {
  ...esgotado,
  productId: 12,
  productName: "COPO",
  stockControlEnabled: false,
  stockControlDisabledReason: "EndOfLine",
};

/** Ligado, mas de giro baixo: sai sozinho, não se religa. */
const giroBaixo: LowStockItemDto = {
  ...esgotado,
  productId: 13,
  productName: "PRATO",
  forecastStatus: "LowTurnover",
};

function renderTable(overrides: Partial<Parameters<typeof LowStockTable>[0]> = {}) {
  const props = {
    scope: "Restock" as const,
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
    onEnableStockControl: vi.fn(),
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
    expect(screen.getByText(/controlados que esgotaram, acabam em menos de 30 dias/)).toBeTruthy();
  });

  it("mostra o mínimo que VALE para o produto, o próprio ou o da loja", () => {
    renderTable({ items: [esgotado] });

    // Mínimo próprio zero: vale o padrão da loja, e é ele que aparece.
    const minimo = screen.getByTitle("Mínimo padrão da loja");
    expect(minimo.textContent).toContain("/ 2");
  });

  it("desliga o controle pelo menu da linha", async () => {
    const { props } = renderTable();

    fireEvent.pointerDown(
      screen.getByLabelText("Opções de VELA"),
      new PointerEvent("pointerdown", { ctrlKey: false, button: 0 }),
    );
    fireEvent.click(await screen.findByText("Desligar controle de estoque"));

    expect(props.onDisableStockControl).toHaveBeenCalledWith(acabando);
  });

  it("na aba Fora do controle diz por quê e troca Comprar por Religar", () => {
    const { props } = renderTable({ scope: "OutOfControl", items: [desligado, giroBaixo] });

    expect(screen.getByText("Desligado · Fim de linha")).toBeTruthy();
    expect(screen.getByText("Giro baixo")).toBeTruthy();
    expect(screen.queryByText("Comprar")).toBeNull();

    // Só o desligado à mão tem Religar: o de giro baixo já está com a chave
    // ligada e volta sozinho quando voltar a vender.
    const religar = screen.getAllByText("Religar");
    expect(religar).toHaveLength(1);
    fireEvent.click(religar[0]);
    expect(props.onEnableStockControl).toHaveBeenCalledWith(desligado);
  });

  it("explica a aba Fora do controle vazia", () => {
    renderTable({ scope: "OutOfControl", items: [] });

    expect(screen.getByText("Todo produto está no controle de estoque.")).toBeTruthy();
  });
});

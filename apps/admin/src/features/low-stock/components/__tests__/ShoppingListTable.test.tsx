import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LowStockItemDto } from "@workspace/api-client-react";
import { ShoppingListTable } from "../ShoppingListTable";
import { ReportTotalBar } from "../ReportTotalBar";

/** Fora do controle por compra pequena de atacado: o selo aparece. */
const balde: LowStockItemDto = {
  productId: 30,
  productGroupId: 3,
  isGroup: false,
  variationCount: 0,
  productName: "BALDE 5L [PRETO]",
  barcode: "789000000030",
  categoryName: "Utilidades",
  supplierName: "Master",
  supplierId: 4,
  supplierCity: "Maringá",
  stock: 0,
  minStock: 0,
  effectiveMinStock: 2,
  stockControlEnabled: false,
  stockControlDisabledReason: "PlanTrip",
  price: 20,
  costPrice: 9,
  recentSales: 6,
  dailyDemand: 0.2,
  averageDailySales: 0.2,
  lastPurchaseQuantity: 3,
  lastPurchaseDate: "2026-09-25T00:00:00",
  hasOpenPurchase: false,
};

/** Controlado e já com compra registrada: sem selo e sem botão. */
const bacia: LowStockItemDto = {
  ...balde,
  productId: 31,
  productName: "BACIA 10L",
  stockControlEnabled: true,
  stockControlDisabledReason: null,
  hasOpenPurchase: true,
};

function renderTable(onComprar = vi.fn()) {
  render(
    <ShoppingListTable
      items={[balde, bacia]}
      isLoading={false}
      filtered={false}
      page={1}
      totalPages={1}
      setPage={vi.fn()}
      onComprar={onComprar}
    />,
  );
  return onComprar;
}

describe("ShoppingListTable", () => {
  afterEach(cleanup);

  it("marca com 'Planejar viagem' só quem está fora do controle por esse motivo", () => {
    renderTable();
    const [linhaBalde, linhaBacia] = screen.getAllByTestId("shopping-list-row");

    expect(within(linhaBalde).getByText("Planejar viagem")).toBeTruthy();
    expect(within(linhaBacia).queryByText("Planejar viagem")).toBeNull();
  });

  it("mostra fornecedor com a cidade e a última compra", () => {
    renderTable();
    const [linhaBalde] = screen.getAllByTestId("shopping-list-row");

    expect(within(linhaBalde).getAllByText("Maringá").length).toBeGreaterThan(0);
    expect(within(linhaBalde).getAllByText(/3 un\. em 25\/09/).length).toBeGreaterThan(0);
  });

  it("com compra registrada, o botão Comprar dá lugar ao aviso de compra em aberto", () => {
    const onComprar = renderTable();
    const [linhaBalde, linhaBacia] = screen.getAllByTestId("shopping-list-row");

    expect(within(linhaBacia).queryByRole("button", { name: /comprar/i })).toBeNull();
    expect(within(linhaBacia).getAllByText("Compra em aberto").length).toBeGreaterThan(0);

    // A ação existe duas vezes no DOM (coluna e resumo do celular); qualquer uma leva ao pedido.
    fireEvent.click(within(linhaBalde).getAllByRole("button", { name: /comprar/i })[0]);
    expect(onComprar).toHaveBeenCalledWith(balde);
  });

  it("sem itens e com filtro, explica que os filtros só estreitam", () => {
    render(
      <ShoppingListTable
        items={[]}
        isLoading={false}
        filtered
        page={1}
        totalPages={1}
        setPage={vi.fn()}
        onComprar={vi.fn()}
      />,
    );

    expect(screen.getByText("Nenhum produto para comprar com esses filtros.")).toBeTruthy();
  });
});

describe("ReportTotalBar", () => {
  afterEach(cleanup);

  it("desmarcada, diz quantos ficaram de fora por compra a caminho", () => {
    render(
      <ReportTotalBar
        total={12}
        suffix="para repor"
        isLoading={false}
        includePurchasesInTransit={false}
        onIncludePurchasesInTransitChange={vi.fn()}
        excludedWithPurchaseInTransit={3}
      />,
    );

    expect(screen.getByTestId("report-total").textContent).toBe(
      "12 produtos para repor · + 3 com compra a caminho",
    );
  });

  it("marcada, o '+ M' some — eles já estão na lista", () => {
    render(
      <ReportTotalBar
        total={1}
        isLoading={false}
        includePurchasesInTransit
        onIncludePurchasesInTransitChange={vi.fn()}
        excludedWithPurchaseInTransit={3}
      />,
    );

    expect(screen.getByTestId("report-total").textContent).toBe("1 produto");
  });

  it("clicar na caixa avisa o novo valor", () => {
    const onChange = vi.fn();
    render(
      <ReportTotalBar
        total={0}
        isLoading={false}
        includePurchasesInTransit={false}
        onIncludePurchasesInTransitChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Incluir os com compra a caminho" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

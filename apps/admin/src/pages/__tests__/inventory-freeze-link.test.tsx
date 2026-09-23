import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ useGetStockFreezeStatus: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStockFreezeStatus: mocks.useGetStockFreezeStatus,
}));

// O relatório e a conferência não interessam aqui: só a troca de aba.
vi.mock("@/features/inventory/hooks/useInventory", () => ({
  useInventory: () => ({
    search: "",
    setSearch: vi.fn(),
    selectedSupplier: "all",
    setSelectedSupplier: vi.fn(),
    selectedCategory: "all",
    setSelectedCategory: vi.fn(),
    stockStatus: "all",
    setStockStatus: vi.fn(),
    page: 1,
    setPage: vi.fn(),
    zoomScale: 1,
    report: null,
    isLoading: false,
    isFetching: false,
    suppliers: [],
    categories: [],
    handleZoomIn: vi.fn(),
    handleZoomOut: vi.fn(),
    handleResetZoom: vi.fn(),
    formatCurrency: String,
    formatPercent: String,
    handleExportExcel: vi.fn(),
  }),
}));
vi.mock("@/features/inventory/components/InventoryMetrics", () => ({ InventoryMetrics: () => null }));
vi.mock("@/features/inventory/components/CategorySummary", () => ({ CategorySummary: () => null }));
vi.mock("@/features/inventory/components/InventoryTable", () => ({ InventoryTable: () => null }));
vi.mock("@/features/inventory-count/components/InventoryCountPanel", () => ({
  InventoryCountPanel: () => <p>painel da conferencia</p>,
}));

const { default: Inventory } = await import("@/pages/inventory");
const { StockFreezeBanner } = await import("@/components/stock-freeze-banner");

describe("Inventário — a aba acompanha a URL", () => {
  it("o 'Ver conferência' da faixa abre a Conferência mesmo com a pessoa já no Inventário", () => {
    // O link aponta para esta mesma página, e o wouter não a remonta: lida só na
    // montagem, a aba ficava na Listagem Geral com a URL em ?aba=conferencia.
    mocks.useGetStockFreezeStatus.mockReturnValue({
      data: { salesPaused: true, pausedSince: "2026-09-23T18:30:00" },
    });
    window.history.pushState(null, "", "/estoque/inventario");
    render(
      <>
        <StockFreezeBanner />
        <Inventory />
      </>,
    );
    expect(screen.getByRole("tab", { name: /Listagem Geral/i }).getAttribute("aria-selected")).toBe("true");

    act(() => {
      fireEvent.click(screen.getByRole("link", { name: "Ver conferência" }));
    });

    expect(window.location.search).toBe("?aba=conferencia");
    expect(screen.getByRole("tab", { name: /Conferência de Produtos/i }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });
});

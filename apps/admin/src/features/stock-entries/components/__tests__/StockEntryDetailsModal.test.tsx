import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import type { ReceivedPurchaseEntryDto } from "@workspace/api-client-react";
import { StockEntryDetailsModal } from "../StockEntryDetailsModal";

const entryDetails = {
  id: 1081,
  supplierName: "Shopee",
  entryDate: "2026-09-14T00:00:00",
  invoiceNumber: "NF-1",
  total: 62.67,
  canEdit: true,
  canDelete: true,
  items: [
    {
      id: 1,
      productId: 10,
      productName: "CARRINHO CAMINHONETE PICKUP CORES",
      barcode: "100",
      productPrice: 19.9,
      quantity: 20,
      unitCost: 3.13,
      totalCost: 62.67,
      grossTotal: 62.67,
      salePrice: 19.9,
      availableQuantity: 20,
      hasConsumedStock: false,
    },
  ],
} as ReceivedPurchaseEntryDto;

function renderModal(overrides: Partial<ComponentProps<typeof StockEntryDetailsModal>> = {}) {
  const props: ComponentProps<typeof StockEntryDetailsModal> = {
    open: true,
    onOpenChange: vi.fn(),
    selectedEntryId: entryDetails.id,
    entryDetails,
    isLoadingDetails: false,
    formatCurrency: (val: number) => `R$ ${val.toFixed(2).replace(".", ",")}`,
    formatShortDate: () => "14/09/2026",
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<StockEntryDetailsModal {...props} />);
  return props;
}

afterEach(() => cleanup());

describe("StockEntryDetailsModal", () => {
  it("avisa que a compra volta para A caminho antes de cancelar", () => {
    // Desde 14/09/2026 cancelar a entrada devolve a compra que a lançou. Quem
    // cancela está na aba Estoque do produto e não vê a tela de Compras: sem
    // este aviso, a situação de uma compra muda sem ninguém contar.
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /Cancelar Entrada/i }));

    expect(screen.getByText(/a compra volta para A caminho/i)).toBeTruthy();
  });

  it("não oferece o cancelamento quando parte do lote já saiu, e diz por quê", () => {
    renderModal({ entryDetails: { ...entryDetails, canDelete: false } });

    expect(screen.queryByRole("button", { name: /Cancelar Entrada/i })).toBeNull();
    expect(screen.getByText(/Contagem Física/i)).toBeTruthy();
  });
});

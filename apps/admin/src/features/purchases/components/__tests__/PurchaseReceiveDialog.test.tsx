import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PurchaseReceiveDialog } from "../PurchaseReceiveDialog";
import type { PurchaseDto, ReceiveForm } from "../../types";

/** Uma compra a caminho, com custo — o caso que o diálogo confirma. */
function compra(): PurchaseDto {
  return {
    id: 7,
    createdAt: "2026-09-12T10:00:00",
    supplierId: 1,
    supplierName: "Shopee",
    productId: 963,
    productGroupId: 805,
    productName: "SACOLA",
    purchaseDate: "2026-09-12T00:00:00",
    quantity: 20,
    grossTotal: 90,
    finalTotal: 90,
    unitGross: 4.5,
    unitFinal: 4.5,
    adjustmentPercent: 0,
    status: "InTransit",
    images: [],
    items: [],
    costSplitManual: false,
  } as unknown as PurchaseDto;
}

function formulario(): ReceiveForm {
  return {
    entryDate: "2026-09-23",
    invoiceNumber: "",
    notes: "",
    price: 9.9,
    items: [],
    finalTotal: 90,
  } as unknown as ReceiveForm;
}

function renderDialog(stockFrozen: boolean) {
  render(
    <PurchaseReceiveDialog
      purchase={compra()}
      form={formulario()}
      onChange={vi.fn()}
      onItemChange={vi.fn()}
      onAddItem={vi.fn()}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      onEditPurchase={vi.fn()}
      isSaving={false}
      stockFrozen={stockFrozen}
    />,
  );
}

describe("PurchaseReceiveDialog — conferência de estoque em andamento", () => {
  it("avisa e trava o confirmar: o servidor recusaria a entrada", () => {
    renderDialog(true);

    expect(screen.getByText(/conferência de estoque em andamento/i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("sem conferência, o confirmar segue liberado", () => {
    renderDialog(false);

    expect(screen.queryByText(/conferência de estoque em andamento/i)).toBeNull();
    expect(
      (screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});

import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PurchasesTable } from "../PurchasesTable";
import type { PurchaseDto } from "../../types";

/** Uma compra na listagem; `status` no formato que a API manda. */
function compra(overrides: Record<string, unknown> = {}): PurchaseDto {
  return {
    id: 7,
    createdAt: "2026-09-12T10:00:00",
    supplierId: 1,
    supplierName: "Shopee",
    productId: 963,
    productGroupId: 805,
    productName: "SACOLA KRAFT GRANDE",
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
    ...overrides,
  } as unknown as PurchaseDto;
}

function renderTable(items: PurchaseDto[], onEdit = vi.fn()) {
  render(
    <PurchasesTable
      items={items}
      isLoading={false}
      searchValue=""
      setSearch={vi.fn()}
      statusFilter="open"
      setStatusFilter={vi.fn()}
      page={1}
      totalPages={1}
      setPage={vi.fn()}
      onEdit={onEdit}
      onDelete={vi.fn()}
      onSetStatus={vi.fn()}
      onReceive={vi.fn()}
      mutatingId={null}
    />,
  );
  return { onEdit };
}

describe("PurchasesTable — no celular (06/10/2026)", () => {
  it("fornecedor, quantidade e situação vêm embaixo do nome", () => {
    // Eram cinco colunas rolando de lado, com a situação e o menu fora da tela.
    renderTable([compra()]);

    const linha = screen.getByTestId("purchase-row");
    const resumo = within(linha).getByText("· 20 un").parentElement!;
    expect(resumo.className).toContain("lg:hidden");
    expect(within(resumo).getByText("Shopee")).toBeTruthy();
    expect(within(resumo).getByText("A caminho")).toBeTruthy();
  });

  it("o recebimento travado diz o motivo por extenso — no toque não há title", () => {
    renderTable([compra({ status: "Pending" })]);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Opções da compra 7" }), {
      button: 0,
      ctrlKey: false,
    });

    const item = screen.getByRole("menuitem", { name: /lançar recebimento/i });
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(within(item).getByText("Marque como a caminho antes")).toBeTruthy();
  });
});

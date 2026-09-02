import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PAYMENT_STATUS, type SaleDto, type SaleItemDto } from "@workspace/api-client-react";
import { SalesHistoryDialog } from "../sales-history-dialog";
import { renderWithHints } from "@/test/render-with-hints";

/**
 * Item da venda #1945 de dev: carregador de R$ 22,00 vendido a R$ 20,00. A API
 * grava o preço LÍQUIDO e o desconto unitário à parte — o cabeçalho da venda
 * fica com `discount: 0`.
 */
const ITEM: SaleItemDto = {
  id: 501,
  createdAt: "2026-09-02T08:52:54",
  updatedAt: null,
  saleId: 1945,
  productId: 163,
  productName: "CARREGADOR CELULAR IPHONE",
  quantity: 1,
  unitPrice: 20,
  discount: 2,
  subtotal: 20,
  unitCost: 10,
  totalCost: 10,
  profit: 10,
};

/** Venda #1945 como `/Pdv/sales/today` a devolve, sobrescrita por teste conforme o caso. */
function makeSale(overrides: Partial<SaleDto> = {}): SaleDto {
  return {
    id: 1945,
    createdAt: "2026-09-02T08:52:54",
    updatedAt: "2026-09-02T08:53:28",
    customerId: null,
    total: 20,
    discount: 0,
    paymentStatus: PAYMENT_STATUS.Paid,
    notes: null,
    payments: [
      {
        id: 1,
        saleId: 1945,
        paymentMethodId: 1,
        paymentMethodName: "Dinheiro",
        amount: 20,
        installments: 1,
        transactionFee: 0,
        sequence: 1,
      },
    ],
    items: [ITEM],
    ...overrides,
  };
}

function renderDialog(sales: SaleDto[]) {
  return renderWithHints(
    <SalesHistoryDialog
      open
      onOpenChange={vi.fn()}
      queuedSalesCount={0}
      loadingSales={false}
      sales={sales}
      busySaleId={null}
      usesCashRegister={false}
      currentUserId={1}
      printingReport={false}
      onRefresh={vi.fn()}
      onPrintSaleReceipt={vi.fn()}
      onEditSale={vi.fn()}
      onCancelSale={vi.fn()}
      onPrintSalesReport={vi.fn()}
    />,
  );
}

describe("SalesHistoryDialog", () => {
  it("deve mostrar o desconto de item, que o cabeçalho da venda não carrega", () => {
    // Era o sintoma: a venda editada com desconto no item aparecia na lista só
    // com o total, como se nunca tivesse tido desconto.
    renderDialog([makeSale()]);

    expect(screen.getByText(/^Desconto - R\$\s2,00$/)).toBeDefined();
  });

  it("deve somar o desconto de item ao desconto da venda", () => {
    // 3 unidades com R$ 2,00 cada mais R$ 1,00 sobre a venda.
    renderDialog([makeSale({ discount: 1, items: [{ ...ITEM, quantity: 3 }] })]);

    expect(screen.getByText(/^Desconto - R\$\s7,00$/)).toBeDefined();
  });

  it("não deve falar em desconto na venda que não teve nenhum", () => {
    renderDialog([makeSale({ items: [{ ...ITEM, discount: 0 }] })]);

    expect(screen.getByText(/R\$\s20,00/)).toBeDefined();
    expect(screen.queryByText(/Desconto/)).toBeNull();
  });
});

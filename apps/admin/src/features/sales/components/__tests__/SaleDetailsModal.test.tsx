import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SaleItemDto } from "@workspace/api-client-react";
import { SaleDetailsModal } from "../SaleDetailsModal";
import type { EnrichedSale } from "../../types";

const mocks = vi.hoisted(() => ({
  useGetSaleDetails: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetSaleDetails: mocks.useGetSaleDetails,
}));

/**
 * Venda #1945 de dev: carregador de R$ 22,00 vendido a R$ 20,00. A API grava o
 * item com o preço LÍQUIDO e o desconto unitário à parte, e o cabeçalho da
 * venda fica com `discount: 0`.
 */
const SALE: EnrichedSale = {
  id: 1945,
  customerId: null,
  discount: 0,
  paymentStatus: 2,
  notes: null,
  total: 20,
  createdAt: "2026-09-02T08:52:54",
  customer: null,
  items: [],
};

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

function renderModal(sale: EnrichedSale, items: SaleItemDto[]) {
  // O detalhe da API é quem traz os itens; a lista da tela vem sem eles.
  mocks.useGetSaleDetails.mockReturnValue({
    data: {
      ...sale,
      payments: [
        {
          id: 1,
          saleId: sale.id,
          paymentMethodId: 1,
          paymentMethodName: "Dinheiro",
          amount: sale.total,
          installments: 1,
          transactionFee: 0,
          sequence: 1,
        },
      ],
      items,
    },
    isLoading: false,
  });

  return render(
    <SaleDetailsModal
      open
      onOpenChange={vi.fn()}
      saleToView={sale}
      paymentMethodById={{ 1: "Dinheiro" }}
      onPrintReceipt={vi.fn()}
      printingSaleId={null}
    />,
  );
}

describe("SaleDetailsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve mostrar o desconto de item, com o subtotal a preço de tabela para a conta fechar", () => {
    // Era o sintoma: o rodapé lia só o `discount` do cabeçalho e dizia "sem
    // desconto" para a venda remarcada no item.
    renderModal(SALE, [ITEM]);

    expect(screen.getByText("Desconto")).toBeDefined();
    expect(screen.getByText(/^-R\$\s2,00$/)).toBeDefined();
    // Subtotal Itens a preço de tabela (22,00) e o preço de tabela riscado na
    // linha do item: 22,00 − 2,00 = 20,00.
    expect(screen.getAllByText(/^R\$\s22,00$/)).toHaveLength(2);
    expect(screen.getByText(/^R\$\s22,00$/, { selector: "p" }).className).toContain("line-through");
  });

  it("deve somar o desconto de item ao desconto da venda", () => {
    // 3 unidades com R$ 2,00 cada mais R$ 1,00 sobre a venda: 66,00 − 7,00 = 59,00.
    renderModal({ ...SALE, discount: 1, total: 59 }, [{ ...ITEM, quantity: 3, subtotal: 60 }]);

    expect(screen.getByText(/^-R\$\s7,00$/)).toBeDefined();
    expect(screen.getByText(/^R\$\s66,00$/)).toBeDefined();
  });

  it("não deve falar em desconto na venda que não teve nenhum", () => {
    renderModal(SALE, [{ ...ITEM, discount: 0 }]);

    expect(screen.queryByText("Desconto")).toBeNull();
    expect(screen.queryByText(/line-through/)).toBeNull();
    // Subtotal Itens continua sendo a soma dos itens.
    expect(screen.getAllByText(/^R\$\s20,00$/).length).toBeGreaterThan(0);
  });
});

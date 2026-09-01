import { describe, expect, it } from "vitest";
import { PAYMENT_STATUS, type SaleDto } from "@workspace/api-client-react";
import { summarizeSalesForReport, toReportSales } from "./sales-report";

/** Venda mínima do PDV, sobrescrita por teste conforme o caso. */
function makeSale(overrides: Partial<SaleDto> = {}): SaleDto {
  return {
    id: 1,
    createdAt: "2026-09-01T10:00:00",
    total: 100,
    discount: 0,
    paymentStatus: PAYMENT_STATUS.Paid,
    items: [{ quantity: 2 }],
    payments: [{ paymentMethodId: 1, paymentMethodName: "Dinheiro", amount: 100 }],
    ...overrides,
  } as unknown as SaleDto;
}

describe("summarizeSalesForReport", () => {
  it("consolida faturamento, desconto e itens das vendas efetivadas", () => {
    const resumo = summarizeSalesForReport([
      makeSale({ id: 1, total: 100, discount: 5 }),
      makeSale({ id: 2, total: 50, discount: 2.5 }),
    ]);

    expect(resumo.salesCount).toBe(2);
    expect(resumo.revenue).toBe(150);
    expect(resumo.discounts).toBe(7.5);
    expect(resumo.itemsCount).toBe(4);
  });

  it("deixa a venda cancelada fora dos totais e a conta à parte", () => {
    // O relatório precisa bater com o dinheiro que entrou, e o cancelamento
    // devolveu o dele.
    const resumo = summarizeSalesForReport([
      makeSale({ id: 1, total: 100 }),
      makeSale({ id: 2, total: 80, paymentStatus: PAYMENT_STATUS.Cancelled }),
    ]);

    expect(resumo.salesCount).toBe(1);
    expect(resumo.cancelledSalesCount).toBe(1);
    expect(resumo.revenue).toBe(100);
    expect(resumo.byPaymentMethod).toHaveLength(1);
    expect(resumo.byPaymentMethod[0]).toMatchObject({ count: 1, amount: 100 });
  });

  it("agrupa os recebimentos por forma de pagamento", () => {
    const resumo = summarizeSalesForReport([
      makeSale({
        id: 1,
        total: 100,
        payments: [
          { paymentMethodId: 1, paymentMethodName: "Dinheiro", amount: 60 },
          { paymentMethodId: 2, paymentMethodName: "Pix", amount: 40 },
        ] as SaleDto["payments"],
      }),
      makeSale({
        id: 2,
        total: 30,
        payments: [{ paymentMethodId: 2, paymentMethodName: "Pix", amount: 30 }] as SaleDto["payments"],
      }),
    ]);

    expect(resumo.byPaymentMethod).toEqual([
      { paymentMethodName: "Dinheiro", count: 1, amount: 60 },
      { paymentMethodName: "Pix", count: 2, amount: 70 },
    ]);
  });

  it("resolve o nome da forma pelo cadastro quando a venda não o guarda", () => {
    const resumo = summarizeSalesForReport(
      [
        makeSale({
          payments: [{ paymentMethodId: 9, amount: 10 }] as SaleDto["payments"],
        }),
      ],
      { 9: "Cartão de Débito" },
    );

    expect(resumo.byPaymentMethod[0].paymentMethodName).toBe("Cartão de Débito");
  });

  it("não inventa valor quando a venda antiga não guardou a divisão", () => {
    const resumo = summarizeSalesForReport([
      makeSale({
        payments: [
          { paymentMethodId: 1, paymentMethodName: "Dinheiro", amount: null },
        ] as SaleDto["payments"],
      }),
    ]);

    expect(resumo.byPaymentMethod[0]).toMatchObject({ count: 1, amount: 0 });
  });

  it("não deixa resíduo de ponto flutuante no faturamento", () => {
    const resumo = summarizeSalesForReport([
      makeSale({ id: 1, total: 0.1 }),
      makeSale({ id: 2, total: 0.2 }),
    ]);

    expect(resumo.revenue).toBe(0.3);
  });
});

describe("toReportSales", () => {
  it("marca a venda cancelada e resolve as formas de pagamento", () => {
    const linhas = toReportSales([
      makeSale({ id: 7, total: 12, paymentStatus: PAYMENT_STATUS.Cancelled }),
      makeSale({ id: 8, payments: [{ paymentMethodId: 5, amount: 10 }] as SaleDto["payments"] }),
    ]);

    expect(linhas[0]).toMatchObject({ id: 7, total: 12, cancelled: true });
    // Sem nome na venda nem no cadastro, a linha sai sem forma — em branco é
    // melhor que um nome errado no impresso.
    expect(linhas[1]).toMatchObject({ id: 8, cancelled: false, paymentNames: [] });
  });
});

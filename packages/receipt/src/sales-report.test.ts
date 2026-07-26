import { describe, expect, it } from "vitest";
import { buildSalesReportHtml } from "./sales-report";
import type { SalesReportData } from "./sales-report";
import { STORE_INFO } from "./store-info";

/** Relatório mínimo, sobrescrito por teste conforme o caso. */
function makeReport(overrides: Partial<SalesReportData> = {}): SalesReportData {
  return {
    sessionId: 12,
    operatorName: "Eduardo Henrique",
    openedAt: "2026-07-25T08:00:00",
    printedAt: "2026-07-25T18:30:00",
    openingBalance: 100,
    summary: {
      salesCount: 2,
      cancelledSalesCount: 1,
      revenue: 130.5,
      discounts: 4.5,
      itemsCount: 7,
      cashAmount: 80.5,
      nonCashAmount: 50,
      expectedCashAmount: 180.5,
      byPaymentMethod: [
        { paymentMethodName: "Dinheiro", count: 2, amount: 80.5 },
        { paymentMethodName: "Pix", count: 1, amount: 50 },
      ],
    },
    sales: [
      { id: 31, createdAt: "2026-07-25T17:10:00", total: 90.5, paymentNames: ["Dinheiro"] },
      { id: 30, createdAt: "2026-07-25T12:05:00", total: 40, paymentNames: ["Pix"] },
    ],
    ...overrides,
  };
}

describe("buildSalesReportHtml", () => {
  it("usa o mesmo papel de 80mm do cupom", () => {
    expect(buildSalesReportHtml(makeReport())).toContain("@page { size: 80mm auto; margin: 0; }");
  });

  it("imprime a identificação da loja", () => {
    const html = buildSalesReportHtml(makeReport());

    expect(html).toContain(STORE_INFO.name);
    expect(html).toContain('src="data:image/png;base64,');
  });

  it("identifica a sessão e o operador", () => {
    const html = buildSalesReportHtml(makeReport());

    expect(html).toContain("#12");
    expect(html).toContain("Eduardo Henrique");
  });

  it("omite a linha do operador quando ele não é conhecido", () => {
    expect(buildSalesReportHtml(makeReport({ operatorName: null }))).not.toContain("Operador");
  });

  it("marca o caixa como aberto quando não houve fechamento", () => {
    const html = buildSalesReportHtml(makeReport());

    expect(html).toContain("Caixa aberto");
    expect(html).not.toContain("Fechado em");
  });

  it("mostra o fechamento quando a sessão já foi encerrada", () => {
    const html = buildSalesReportHtml(makeReport({ closedAt: "2026-07-25T19:00:00" }));

    expect(html).toContain("Fechado em");
    expect(html).not.toContain("Caixa aberto");
  });

  it("traz o consolidado da sessão", () => {
    const html = buildSalesReportHtml(makeReport());

    expect(html).toContain("FATURAMENTO");
    expect(html).toContain("130,50");
    expect(html).toContain("Itens vendidos");
  });

  it("quebra os recebimentos por forma de pagamento com a contagem", () => {
    const html = buildSalesReportHtml(makeReport());

    expect(html).toContain("Dinheiro (2)");
    expect(html).toContain("Pix (1)");
  });

  it("avisa quando a sessão não teve recebimento", () => {
    const html = buildSalesReportHtml(
      makeReport({
        summary: { ...makeReport().summary, byPaymentMethod: [] },
      }),
    );

    expect(html).toContain("Nenhum recebimento na sessão.");
  });

  it("fecha a conferência da gaveta com o fundo de troco", () => {
    const html = buildSalesReportHtml(makeReport());

    expect(html).toContain("Fundo de troco");
    expect(html).toContain("ESPERADO EM CAIXA");
  });

  it("lista as vendas com a forma de pagamento", () => {
    const html = buildSalesReportHtml(makeReport());

    expect(html).toContain("#31");
    expect(html).toContain("#30");
  });

  it("risca o valor das vendas canceladas", () => {
    const html = buildSalesReportHtml(
      makeReport({
        sales: [{ id: 31, createdAt: "2026-07-25T17:10:00", total: 90.5, cancelled: true }],
      }),
    );

    expect(html).toContain('<span class="struck">');
    expect(html).toContain("CANCELADA");
  });

  it("avisa quando a sessão não teve venda", () => {
    const html = buildSalesReportHtml(makeReport({ sales: [] }));

    expect(html).toContain("Nenhuma venda registrada na sessão.");
  });

  it("escapa o nome da forma de pagamento vindo do cadastro", () => {
    const html = buildSalesReportHtml(
      makeReport({
        summary: {
          ...makeReport().summary,
          byPaymentMethod: [{ paymentMethodName: "<script>x</script>", count: 1, amount: 1 }],
        },
      }),
    );

    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

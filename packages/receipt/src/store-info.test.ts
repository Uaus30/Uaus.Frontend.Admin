import { describe, expect, it } from "vitest";
import { RECEIPT_FOOTER_MESSAGE, STORE_INFO, resolveStoreInfo, toReceiptStore } from "./store-info";
import { buildReceiptHtml } from "./render";
import { buildSalesReportHtml } from "./sales-report";
import type { ReceiptData } from "./types";

/** Cupom mínimo válido, para os testes de integração com o cabeçalho. */
function makeReceipt(overrides: Partial<ReceiptData> = {}): ReceiptData {
  return {
    saleId: 1,
    createdAt: "2026-08-08T10:00:00",
    items: [{ name: "CHICLETE DE BOLA", quantity: 1, unitPrice: 0.25 }],
    payments: [{ name: "Dinheiro", amount: 0.25 }],
    total: 0.25,
    ...overrides,
  };
}

describe("resolveStoreInfo", () => {
  it("devolve a identidade padrão quando não há cadastro", () => {
    expect(resolveStoreInfo()).toEqual({
      storeName: "MÁXIMO 30",
      addressLine: "RUA PARANAGUÁ, 663",
      // Único campo cujo padrão é vazio: ele nunca esteve hardcoded aqui, então
      // não há impressão anterior a preservar e chutar uma cidade sairia errado.
      cityState: "",
      phone: "Cel: (44) 99137-2305",
      document: "64.958.682/0001-22",
      receiptFooterMessage: "Obrigado pela preferência!",
    });
  });

  it("usa o valor do cadastro campo a campo", () => {
    const info = resolveStoreInfo({
      storeName: "LOJA NOVA",
      addressLine: "AV. BRASIL, 100",
      cityState: "TAPIRA-PR",
      phone: "(11) 90000-0000",
      document: "11.222.333/0001-44",
      receiptFooterMessage: "Volte sempre!",
    });

    expect(info).toEqual({
      storeName: "LOJA NOVA",
      addressLine: "AV. BRASIL, 100",
      cityState: "TAPIRA-PR",
      phone: "(11) 90000-0000",
      document: "11.222.333/0001-44",
      receiptFooterMessage: "Volte sempre!",
    });
  });

  it("cai no padrão só nos campos vazios, mantendo os preenchidos", () => {
    // É o contrato do backend: colunas NOT NULL DEFAULT '' — campo não
    // preenchido chega como string vazia, não como ausência.
    const info = resolveStoreInfo({ storeName: "LOJA NOVA", addressLine: "", phone: "   " });

    expect(info.storeName).toBe("LOJA NOVA");
    expect(info.addressLine).toBe("RUA PARANAGUÁ, 663");
    expect(info.phone).toBe("Cel: (44) 99137-2305");
    expect(info.document).toBe("64.958.682/0001-22");
  });

  it("apara espaços do que veio do cadastro", () => {
    expect(resolveStoreInfo({ storeName: "  LOJA NOVA  " }).storeName).toBe("LOJA NOVA");
  });

  it("aceita objetos com campos extras, como o próprio DTO da API", () => {
    const settings = { usesCashRegister: true, storeName: "LOJA NOVA" };

    expect(resolveStoreInfo(settings).storeName).toBe("LOJA NOVA");
  });
});

describe("identidade do cadastro no cupom", () => {
  it("imprime a identidade resolvida no cabeçalho", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        store: resolveStoreInfo({
          storeName: "LOJA NOVA",
          addressLine: "AV. BRASIL, 100",
          phone: "(11) 90000-0000",
        }),
      }),
    );

    expect(html).toContain("LOJA NOVA");
    expect(html).toContain("AV. BRASIL, 100");
    expect(html).toContain("(11) 90000-0000");
    expect(html).not.toContain(STORE_INFO.name);
  });

  it("imprime cidade/UF na linha logo abaixo do endereço", () => {
    const html = buildReceiptHtml(
      makeReceipt({
        store: resolveStoreInfo({ addressLine: "AV. BRASIL, 100", cityState: "TAPIRA-PR" }),
      }),
    );

    expect(html).toContain("AV. BRASIL, 100");
    expect(html).toContain("TAPIRA-PR");
    // A ordem importa: cidade/UF é a segunda linha do endereço, não uma linha
    // solta em qualquer lugar do cabeçalho.
    expect(html.indexOf("AV. BRASIL, 100")).toBeLessThan(html.indexOf("TAPIRA-PR"));
  });

  it("cidade/UF em branco não deixa linha vazia no cabeçalho", () => {
    // Sem o filtro, o cupom ganharia uma linha em branco entre o endereço e o
    // telefone em toda loja que ainda não preencheu o campo — que é o estado de
    // TODAS elas logo depois do deploy.
    const semCidade = resolveStoreInfo({ addressLine: "AV. BRASIL, 100" });

    expect(toReceiptStore(semCidade).addressLines).toEqual(["AV. BRASIL, 100"]);
  });

  it("imprime o rótulo CNPJ no documento cru vindo do cadastro", () => {
    const html = buildReceiptHtml(
      makeReceipt({ store: resolveStoreInfo({ document: "11.222.333/0001-44" }) }),
    );

    expect(html).toContain("CNPJ: 11.222.333/0001-44");
  });

  it("não dobra o rótulo quando o cadastro já o traz", () => {
    const html = buildReceiptHtml(
      makeReceipt({ store: resolveStoreInfo({ document: "CPF: 123.456.789-00" }) }),
    );

    expect(html).toContain("CPF: 123.456.789-00");
    expect(html).not.toContain("CNPJ: CPF:");
  });

  it("imprime a mensagem de rodapé do cadastro, escapada", () => {
    const html = buildReceiptHtml(
      makeReceipt({ store: resolveStoreInfo({ receiptFooterMessage: "Volte <sempre>!" }) }),
    );

    expect(html).toContain("Volte &lt;sempre&gt;!");
    expect(html).not.toContain(RECEIPT_FOOTER_MESSAGE);
  });

  it("mantém o rodapé padrão sem identidade do cadastro", () => {
    expect(buildReceiptHtml(makeReceipt())).toContain(RECEIPT_FOOTER_MESSAGE);
  });

  it("também identifica a loja no relatório de vendas", () => {
    const html = buildSalesReportHtml({
      sessionId: 1,
      openedAt: "2026-08-08T08:00:00",
      printedAt: "2026-08-08T18:00:00",
      openingBalance: 100,
      summary: {
        salesCount: 0,
        cancelledSalesCount: 0,
        revenue: 0,
        discounts: 0,
        itemsCount: 0,
        cashAmount: 0,
        nonCashAmount: 0,
        expectedCashAmount: 100,
        byPaymentMethod: [],
      },
      sales: [],
      store: resolveStoreInfo({ storeName: "LOJA NOVA", document: "11.222.333/0001-44" }),
    });

    expect(html).toContain("LOJA NOVA");
    expect(html).toContain("CNPJ: 11.222.333/0001-44");
    expect(html).not.toContain(STORE_INFO.name);
  });
});

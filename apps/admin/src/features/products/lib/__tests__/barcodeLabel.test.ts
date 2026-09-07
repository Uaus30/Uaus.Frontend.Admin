import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ buildBarcodeSvg: vi.fn(() => `<svg data-local="1"></svg>`) }));

// Só o desenho é dublado: a jsbarcode mede texto num canvas, que o jsdom não
// tem, e sem o dublê ela devolveria null para qualquer código.
vi.mock("../barcode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../barcode")>()),
  buildBarcodeSvg: mocks.buildBarcodeSvg,
}));

const { buildBarcodeLabelHtml } = await import("../barcodeLabel");

/** Substitui a jsbarcode nos testes: devolve um SVG marcado com o código. */
const stubBarcode = (value: string) => `<svg data-code="${value}"></svg>`;

describe("buildBarcodeLabelHtml", () => {
  it("leva o SVG das barras já desenhado, sem carregar biblioteca de fora", () => {
    // Regressão: o documento carregava a jsbarcode de `cdn.jsdelivr.net` e só
    // imprimia no `onload`. Sem internet, saía a etiqueta com nome e preço e
    // sem barras — e o caixa só descobre com o papel colado no produto.
    const html = buildBarcodeLabelHtml(
      { barcode: "7896665551252", name: "CANECA", price: 12.9 },
      stubBarcode,
    );

    expect(html).toContain('<svg data-code="7896665551252"></svg>');
    expect(html).not.toContain("cdn.jsdelivr.net");
    expect(html).not.toContain("<script src=");
  });

  it("imprime nome em caixa alta, cortado em 30 caracteres, e o preço formatado", () => {
    const html = buildBarcodeLabelHtml(
      { barcode: "7891234567895", name: "conjunto de potes de vidro hermetico 3 pecas", price: 1234.5 },
      stubBarcode,
    );

    expect(html).toContain("CONJUNTO DE POTES DE VIDRO HER");
    expect(html).toMatch(/R\$\s1\.234,50/);
  });

  it("escapa o nome do produto", () => {
    const html = buildBarcodeLabelHtml(
      { barcode: "7891234567895", name: `Café <"Forte">`, price: 1 },
      stubBarcode,
    );

    expect(html).toContain("CAFÉ &lt;&quot;FORTE&quot;&gt;");
  });

  it("imprime a etiqueta sem barras quando a jsbarcode recusa o código", () => {
    // Melhor nome e preço do que nenhuma etiqueta: quem imprimiu vê o papel.
    const html = buildBarcodeLabelHtml({ barcode: "", name: "CANECA", price: 1 }, () => null);

    expect(html).toContain("CANECA");
    expect(html).not.toContain("<svg");
  });

  it("desenha com a jsbarcode local, nas medidas da etiqueta de 80mm", () => {
    // É o caminho da impressão de verdade: sem injetar gerador nenhum, o
    // desenho tem que sair da biblioteca do próprio bundle.
    const html = buildBarcodeLabelHtml({ barcode: "7891234567895", name: "CANECA", price: 1 });

    expect(mocks.buildBarcodeSvg).toHaveBeenCalledWith(
      "7891234567895",
      expect.objectContaining({ width: 2, height: 40 }),
    );
    expect(html).toContain(`<svg data-local="1"></svg>`);
  });
});

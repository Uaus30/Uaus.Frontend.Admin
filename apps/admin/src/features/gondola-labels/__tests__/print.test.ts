import { describe, expect, it, vi } from "vitest";
import { PRODUCT_LABEL_TYPE } from "@workspace/api-client-react";
import { DEFAULT_BARCODE_MODULE_WIDTH } from "@/lib/barcode-svg";

const mocks = vi.hoisted(() => ({ buildBarcodeSvg: vi.fn() }));

// A jsbarcode desenha no DOM e não roda no jsdom; só ela é dublada, para o
// teste ver com que largura a folha pede as barras.
vi.mock("@/lib/barcode-svg", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/barcode-svg")>()),
  buildBarcodeSvg: mocks.buildBarcodeSvg,
}));

import {
  LABEL_BARCODE_BAR_HEIGHT,
  LABEL_BARCODE_BOTTOM_MARGIN,
  LABEL_BARCODE_FONT_SIZE,
  LABEL_BARCODE_MODULE_WIDTH,
  buildLabelSheetHtml,
  escapeHtml,
  formatLabelPrice,
  getProductNameFontSizePt,
} from "../print";
import type { PrintableLabel } from "../types";

/** Etiqueta de exemplo; os testes ajustam só o que interessa. */
function label(patch?: Partial<PrintableLabel>): PrintableLabel {
  return {
    productName: "Produto Exemplo de Impressão 1 Litro",
    barcode: "7891234567895",
    price: 1.99,
    labelType: PRODUCT_LABEL_TYPE.Normal,
    quantity: 1,
    ...patch,
  };
}

/** Substitui a jsbarcode nos testes: devolve um SVG marcado com o código. */
const stubBarcode = (value: string) => `<svg data-code="${value}"></svg>`;

describe("formatLabelPrice", () => {
  it("formata com vírgula, duas casas e separador de milhar", () => {
    expect(formatLabelPrice(1.9)).toBe("1,90");
    expect(formatLabelPrice(1234.5)).toBe("1.234,50");
  });
});

describe("getProductNameFontSizePt", () => {
  it("retorna 11.5pt para nomes curtos (<= 20 chars)", () => {
    expect(getProductNameFontSizePt("Caneca Branca")).toBe(11.5);
    expect(getProductNameFontSizePt("BONECA NICINHA 20CM")).toBe(11.5);
  });

  it("retorna 9.5pt para nomes médios (21 a 34 chars)", () => {
    expect(getProductNameFontSizePt("BONECA NICINHA BOLHA DE SABÃO")).toBe(9.5);
    expect(getProductNameFontSizePt("COFFEE AND JESSIE CART PICA PAU")).toBe(9.5);
  });

  it("retorna 8pt para nomes longos (35 a 48 chars)", () => {
    expect(getProductNameFontSizePt("CONJUNTO DE POTES DE VIDRO HERMETICO 3 PECAS")).toBe(8);
  });

  it("retorna 7pt para nomes muito longos (> 48 chars)", () => {
    expect(
      getProductNameFontSizePt("CONJUNTO DE POTES DE VIDRO HERMETICO RETANGULAR COM TAMPA 3 UNIDADES"),
    ).toBe(7);
  });
});

describe("escapeHtml", () => {
  it("escapa os cinco caracteres especiais de HTML", () => {
    expect(escapeHtml(`<Açaí & "Mel" 'Puro'>`)).toBe("&lt;Açaí &amp; &quot;Mel&quot; &#39;Puro&#39;&gt;");
  });
});

describe("buildLabelSheetHtml", () => {
  it("repete a célula conforme a quantidade do item", () => {
    const html = buildLabelSheetHtml([label({ quantity: 3 })], stubBarcode);

    expect(html.match(/class="label"/g)).toHaveLength(3);
  });

  it("pinta o fundo conforme o tipo da etiqueta", () => {
    const html = buildLabelSheetHtml(
      [
        label({ labelType: PRODUCT_LABEL_TYPE.Promotion }),
        label({ labelType: PRODUCT_LABEL_TYPE.Clearance }),
      ],
      stubBarcode,
    );

    expect(html).toContain("background:#ffe600");
    expect(html).toContain("background:#ee3524");
  });

  it("escapa o nome do produto e omite as barras quando não há código", () => {
    const html = buildLabelSheetHtml(
      [label({ productName: `Café <"Forte"> & Cia`, barcode: null })],
      stubBarcode,
    );

    expect(html).toContain("Café &lt;&quot;Forte&quot;&gt; &amp; Cia");
    expect(html).toContain("font-size:11.5pt;");
    expect(html).toContain('class="label-bottom no-barcode"');
    expect(html).not.toContain("<svg");
  });

  it("injeta o SVG gerado para o código de barras", () => {
    const html = buildLabelSheetHtml([label()], stubBarcode);

    expect(html).toContain('<svg data-code="7891234567895"></svg>');
  });

  it("monta a folha A4 com grade de duas colunas e altura de 24mm", () => {
    const html = buildLabelSheetHtml([label()], stubBarcode);

    expect(html).toContain("size: A4 portrait");
    expect(html).toContain("repeat(2, 1fr)");
    expect(html).toContain("height: 24mm;");
    expect(html).toContain("print-color-adjust: exact");
  });

  it("contorna a etiqueta com retângulo de canto vivo, que é a linha do recorte", () => {
    const html = buildLabelSheetHtml([label()], stubBarcode);

    expect(html).toContain("border: 0.35mm solid #9a9a9a;");
    expect(html).not.toContain("border-radius");
  });

  it("alinha preço e barras pelo centro, e não pela base", () => {
    const html = buildLabelSheetHtml([label()], stubBarcode);
    const bottomRule = html.match(/\.label-bottom \{[^}]*\}/)?.[0] ?? "";

    expect(bottomRule).toContain("align-items: center;");
    expect(bottomRule).not.toContain("flex-end");
  });

  it("faz as barras cederem espaço ao preço, e não o contrário", () => {
    const html = buildLabelSheetHtml([label()], stubBarcode);
    const barcodeRule = html.match(/\.label-barcode \{[^}]*\}/)?.[0] ?? "";
    const priceRule = html.match(/\.label-price \{[^}]*\}/)?.[0] ?? "";

    expect(barcodeRule).toContain("flex: 0 1 auto;");
    expect(barcodeRule).toContain("min-width: 0;");
    expect(priceRule).toContain("flex: 0 0 auto;");
  });

  it("limita as barras a metade da etiqueta, para o preço ficar com a outra", () => {
    const html = buildLabelSheetHtml([label()], stubBarcode);
    const barcodeRule = html.match(/\.label-barcode \{[^}]*\}/)?.[0] ?? "";

    expect(barcodeRule).toContain("max-width: 50%;");
  });

  it("fixa a altura do código em mm, para a folha inteira sair com a mesma", () => {
    const html = buildLabelSheetHtml([label()], stubBarcode);
    const svgRule = html.match(/\.label-barcode svg \{[^}]*\}/)?.[0] ?? "";

    // Altura em mm + `stretch` no desenho: é o par que impede o código apertado
    // pela largura de encolher na vertical junto.
    expect(svgRule).toMatch(/height: [\d.]+mm;/);
  });

  it("pede as barras no desenho reto, mais largas e com número maior", () => {
    mocks.buildBarcodeSvg.mockReturnValue("<svg></svg>");

    // Sem o segundo argumento: é o caminho que a impressão de verdade usa.
    buildLabelSheetHtml([label()]);

    expect(mocks.buildBarcodeSvg).toHaveBeenCalledWith("7891234567895", {
      width: LABEL_BARCODE_MODULE_WIDTH,
      height: LABEL_BARCODE_BAR_HEIGHT,
      fontSize: LABEL_BARCODE_FONT_SIZE,
      marginBottom: LABEL_BARCODE_BOTTOM_MARGIN,
      flat: true,
      stretch: true,
    });

    // O EAN-13 guardado tem barra de guarda comprida e o primeiro dígito de
    // fora; na gôndola o padrão é reto, com o número inteiro embaixo.
    expect(LABEL_BARCODE_MODULE_WIDTH).toBeGreaterThan(DEFAULT_BARCODE_MODULE_WIDTH);
    expect(LABEL_BARCODE_FONT_SIZE).toBeGreaterThan(14);
  });
});

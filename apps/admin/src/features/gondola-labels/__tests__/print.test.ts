import { describe, expect, it } from "vitest";
import { PRODUCT_LABEL_TYPE } from "@workspace/api-client-react";
import { hasValidEanCheckDigit, resolveBarcodeFormat } from "../barcode";
import { buildLabelSheetHtml, escapeHtml, formatLabelPrice, getProductNameFontSizePt } from "../print";
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
    expect(getProductNameFontSizePt("CONJUNTO DE POTES DE VIDRO HERMETICO RETANGULAR COM TAMPA 3 UNIDADES")).toBe(7);
  });
});

describe("escapeHtml", () => {
  it("escapa os cinco caracteres especiais de HTML", () => {
    expect(escapeHtml(`<Açaí & "Mel" 'Puro'>`)).toBe("&lt;Açaí &amp; &quot;Mel&quot; &#39;Puro&#39;&gt;");
  });
});

describe("hasValidEanCheckDigit", () => {
  it("valida o dígito verificador de EAN-13 e EAN-8", () => {
    expect(hasValidEanCheckDigit("7891234567895")).toBe(true);
    expect(hasValidEanCheckDigit("7891234567890")).toBe(false);
    expect(hasValidEanCheckDigit("40170725")).toBe(true);
    expect(hasValidEanCheckDigit("40170724")).toBe(false);
  });

  it("recusa comprimentos que não são EAN", () => {
    expect(hasValidEanCheckDigit("123456")).toBe(false);
    expect(hasValidEanCheckDigit("ABC")).toBe(false);
  });
});

describe("resolveBarcodeFormat", () => {
  it("escolhe EAN quando o verificador fecha e CODE128 caso contrário", () => {
    expect(resolveBarcodeFormat("7891234567895")).toBe("EAN13");
    expect(resolveBarcodeFormat("40170725")).toBe("EAN8");
    expect(resolveBarcodeFormat("7891234567890")).toBe("CODE128");
    expect(resolveBarcodeFormat("COD-INTERNO-1")).toBe("CODE128");
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
});


import { describe, expect, it } from "vitest";
import { PIECE_SPECS } from "../../template/geometry";
import {
  availableProducts,
  CATALOG_FORMATS,
  DEFAULT_FORMAT,
  describeFormatSize,
  FORMAT_ORDER,
} from "../formats";
import { productLink } from "../links";
import type { CatalogThemeOption } from "../themes";

const theme: CatalogThemeOption = {
  key: "1",
  theme: 1,
  label: "Geral",
  title: "Destaques da loja",
  products: 608,
  productsWithLargePhoto: 371,
};

describe("formatos do catálogo", () => {
  it("o seletor abre no banner 9:16 e oferece os três, com o PDF por último", () => {
    expect(DEFAULT_FORMAT).toBe("story");
    expect(FORMAT_ORDER).toEqual(["story", "feed", "pdf"]);
    expect(FORMAT_ORDER.map((key) => CATALOG_FORMATS[key].key)).toEqual(FORMAT_ORDER);
  });

  it("as quantidades são as combinadas com o dono: 9 no banner e 30 no PDF (5 páginas)", () => {
    expect(CATALOG_FORMATS.story.count).toBe(9);
    expect(CATALOG_FORMATS.feed.count).toBe(6);
    expect(CATALOG_FORMATS.pdf.count).toBe(30);
    expect(CATALOG_FORMATS.pdf.count).toBeGreaterThanOrEqual(24);
    expect(CATALOG_FORMATS.pdf.count).toBeLessThanOrEqual(32);
  });

  it("o PDF fecha páginas inteiras, e o banner cabe numa só", () => {
    const perPage = PIECE_SPECS[CATALOG_FORMATS.pdf.piece].maxProducts;

    expect(CATALOG_FORMATS.pdf.count % perPage).toBe(0);
    expect(CATALOG_FORMATS.story.count).toBe(PIECE_SPECS.story.maxProducts);
    expect(CATALOG_FORMATS.feed.count).toBe(PIECE_SPECS.feed.maxProducts);
  });

  it("o servidor aceita o pedido de cada formato: até 40 produtos e 12 reservas", () => {
    for (const key of FORMAT_ORDER) {
      expect(CATALOG_FORMATS[key].count).toBeLessThanOrEqual(40);
      expect(CATALOG_FORMATS[key].spare).toBeLessThanOrEqual(12);
    }
  });

  it("banner é imagem e catálogo é PDF — o vocabulário do dono", () => {
    expect(CATALOG_FORMATS.story).toMatchObject({ noun: "banner", extension: "jpg", mimeType: "image/jpeg" });
    expect(CATALOG_FORMATS.feed).toMatchObject({ noun: "banner", extension: "jpg" });
    expect(CATALOG_FORMATS.pdf).toMatchObject({
      noun: "catálogo",
      extension: "pdf",
      mimeType: "application/pdf",
    });
  });

  it("descreve o tamanho: exato no banner, 'até' no catálogo", () => {
    expect(describeFormatSize(CATALOG_FORMATS.story)).toBe("9 produtos");
    expect(describeFormatSize(CATALOG_FORMATS.pdf)).toBe("até 30 produtos");
  });

  it("só o PDF exige foto grande — e conta só os cadastros que a têm", () => {
    expect(CATALOG_FORMATS.pdf.minPhotoSide).toBe(300);
    expect(availableProducts(theme, CATALOG_FORMATS.pdf)).toBe(371);
    expect(availableProducts(theme, CATALOG_FORMATS.story)).toBe(608);
    expect(availableProducts(theme, CATALOG_FORMATS.feed)).toBe(608);
  });
});

describe("productLink", () => {
  it("aponta para o produto no site, com a origem que as métricas do site leem", () => {
    const url = new URL(productLink(905, new Date("2026-10-03T15:00:00Z")));

    expect(url.origin + url.pathname).toBe("https://uaus.com.br/produtos/905");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: "whatsapp",
      utm_medium: "catalogo",
      utm_campaign: "catalogo-2026-10-03",
    });
  });

  it("a campanha leva o dia da LOJA: às 23h de Brasília ainda é o mesmo dia", () => {
    // 02:00 UTC do dia 4 são 23:00 do dia 3 em Brasília.
    expect(productLink(1, new Date("2026-10-04T02:00:00Z"))).toContain("utm_campaign=catalogo-2026-10-03");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BANNERS_PER_PAGE,
  BANNER_NAME_FONT_PT,
  BANNER_SIZE_MM,
  CUT_LINE,
  bannerNameStyle,
  bannerTitleFontSizePt,
  bannerPriceFontSizePt,
  buildPromotionBannerSheetHtml,
  openPromotionBannerTab,
  splitBannerPrice,
} from "../banner-print";
import type { PromotionBannerItem } from "../hooks/promotionBannerRules";

/** Banner de exemplo; os testes ajustam só o que interessa. */
function banner(patch?: Partial<PromotionBannerItem>): PromotionBannerItem {
  return { productName: "COPO AMERICANO", lead: "", price: 9.9, copies: 1, ...patch };
}

const contar = (html: string, trecho: string) => html.split(trecho).length - 1;

describe("splitBannerPrice", () => {
  it("separa inteiro e centavos no formato pt-BR", () => {
    expect(splitBannerPrice(9.9)).toEqual({ integer: "9", cents: "90" });
    expect(splitBannerPrice(20)).toEqual({ integer: "20", cents: "00" });
    expect(splitBannerPrice(1234.5)).toEqual({ integer: "1.234", cents: "50" });
  });
});

describe("bannerPriceFontSizePt", () => {
  it("encolhe conforme os dígitos inteiros — o ponto de milhar não conta", () => {
    // A loja vende até R$ 30: um e dois dígitos são os corpos de verdade.
    expect(bannerPriceFontSizePt("9")).toBe(140);
    expect(bannerPriceFontSizePt("29")).toBe(108);
    expect(bannerPriceFontSizePt("199")).toBe(78);
    expect(bannerPriceFontSizePt("1.234")).toBe(60);
    expect(bannerPriceFontSizePt("12.345")).toBe(50);
  });
});

describe("bannerTitleFontSizePt", () => {
  it("'PROMOÇÃO' sai no teto de 34pt, e título mais longo encolhe até o piso", () => {
    expect(bannerTitleFontSizePt("PROMOÇÃO")).toBe(34);
    expect(bannerTitleFontSizePt("OFERTA")).toBe(34);
    expect(bannerTitleFontSizePt("LIQUIDAÇÃO")).toBe(31);
    expect(bannerTitleFontSizePt("QUEIMA DE ESTOQUE")).toBe(18);
    expect(bannerTitleFontSizePt("A".repeat(40))).toBe(12);
  });
});

describe("bannerNameStyle", () => {
  it("um corpo só, em duas linhas, para o nome curto e o longo", () => {
    // Pedido do dono (20/10/2026): o mesmo tamanho com uma ou duas linhas.
    for (const nome of [
      "COPO AMERICANO",
      "NOME DO PRODUTO COMPLETO",
      "CONJUNTO DE POTES DE VIDRO HERMETICO 3 PECAS",
    ]) {
      expect(bannerNameStyle(nome)).toEqual({ fontSizePt: BANNER_NAME_FONT_PT, lines: 2 });
    }
  });

  it("só a palavra que sozinha não cabe numa linha encolhe", () => {
    expect(bannerNameStyle("DESENGORDURANTE CONCENTRADO")).toEqual({ fontSizePt: 15, lines: 2 });
    expect(bannerNameStyle("SUPERDESENGORDURANTEPLUS")).toEqual({ fontSizePt: 12, lines: 2 });
  });
});

describe("buildPromotionBannerSheetHtml", () => {
  it("repete o banner conforme as cópias e fecha a folha a cada seis", () => {
    const html = buildPromotionBannerSheetHtml([
      banner({ copies: 4 }),
      banner({ productName: "ESMALTE", copies: 3 }),
    ]);

    expect(BANNERS_PER_PAGE).toBe(6);
    expect(contar(html, 'class="banner"')).toBe(7);
    expect(contar(html, 'class="page"')).toBe(2);
  });

  it("o banner é quadrado e a grade de 2 × 3 cabe na área útil da A4", () => {
    // O comprido (95 × 135mm) parecia, na prateleira, apontar o preço para o
    // produto de baixo (dono, 20/10/2026).
    const html = buildPromotionBannerSheetHtml([banner()]);

    expect(html).toMatch(
      new RegExp(`\\.banner \\{[^}]*width: ${BANNER_SIZE_MM}mm;[^}]*height: ${BANNER_SIZE_MM}mm;`),
    );
    expect(html).toContain(`grid-template-columns: repeat(2, ${BANNER_SIZE_MM}mm)`);
    expect(2 * BANNER_SIZE_MM).toBeLessThanOrEqual(194);
    expect(3 * BANNER_SIZE_MM).toBeLessThanOrEqual(280);
  });

  it("a grade começa no canto superior esquerdo da folha, e não centralizada", () => {
    // Com um ou dois banners, eles saem no alto do papel (pedido do dono).
    expect(buildPromotionBannerSheetHtml([banner()])).toMatch(
      /\.page \{[^}]*align-items: flex-start;[^}]*justify-content: flex-start;/,
    );
  });

  it("folha com um banner só usa uma coluna, para não sobrar linha de corte sem banner", () => {
    expect(buildPromotionBannerSheetHtml([banner()])).toContain('class="sheet single"');
    expect(buildPromotionBannerSheetHtml([banner({ copies: 2 })])).not.toContain("sheet single");
  });

  it("escapa o nome e monta o preço com os centavos na metade do corpo", () => {
    const html = buildPromotionBannerSheetHtml([banner({ productName: `<Açaí & "Mel">`, price: 9.9 })]);

    expect(html).toContain("&lt;Açaí &amp; &quot;Mel&quot;&gt;");
    expect(html).toContain('<span style="font-size:140pt;">9</span>');
    expect(html).toContain('<span style="font-size:70pt;">,90</span>');
  });

  it("a frase acima do preço começa onde o preço começa, no mesmo bloco", () => {
    // Pedido do dono (20/10/2026): "3 POR" alinhado à esquerda do número, e não
    // centrado sobre ele. O bloco é centrado no banner; dentro dele, à esquerda.
    const doc = new DOMParser().parseFromString(
      buildPromotionBannerSheetHtml([banner({ lead: "3 por", price: 20 })]),
      "text/html",
    );
    const bloco = doc.querySelector(".banner-price-block")!;

    expect([...bloco.children].map((filho) => filho.className)).toEqual(["banner-lead", "banner-price"]);
    expect(doc.head.innerHTML).toMatch(/\.banner-price-block \{[^}]*align-items: flex-start;/);
  });

  it("a linha acima do preço só sai quando existe", () => {
    expect(buildPromotionBannerSheetHtml([banner({ lead: "3 por", price: 20 })])).toContain(
      '<div class="banner-lead">3 por</div>',
    );
    expect(buildPromotionBannerSheetHtml([banner()])).not.toContain('class="banner-lead"');
  });

  it("a última folha não força quebra: as folhas são as únicas filhas do contêiner delas", () => {
    // O botão e o script também são filhos do body. Com as folhas soltas lá, o
    // `.page:last-child` nunca casava e toda impressão saía com uma folha em
    // branco no fim (achado da revisão de 16/10/2026).
    const doc = new DOMParser().parseFromString(
      buildPromotionBannerSheetHtml([banner({ copies: 7 })]),
      "text/html",
    );
    const pages = doc.querySelectorAll(".page");
    const container = pages[0].parentElement!;

    expect(pages).toHaveLength(2);
    expect(container.children).toHaveLength(2);
    expect(container.lastElementChild!.matches(".pages > .page:last-child")).toBe(true);
    expect(doc.body.querySelector(".pages + script")).not.toBeNull();
  });

  it("a folha imprime sozinha, tem o botão de reimpressão e a linha de corte laranja fina", () => {
    const html = buildPromotionBannerSheetHtml([banner()]);

    expect(html).toContain("window.print()");
    expect(html).toContain('id="reprint"');
    expect(html).toContain(CUT_LINE);
    expect(html).toContain("PROMOÇÃO");
  });

  it("o título da faixa é o mesmo em toda a folha, escapado, e 'PROMOÇÃO' é o padrão", () => {
    const comTitulo = buildPromotionBannerSheetHtml([banner({ copies: 2 })], `SÓ <HOJE>`);

    expect(contar(comTitulo, 'class="banner-head" style="font-size:34pt;">SÓ &lt;HOJE&gt;</div>')).toBe(2);
    expect(comTitulo).not.toContain("PROMOÇÃO");
    expect(buildPromotionBannerSheetHtml([banner()])).toContain(">PROMOÇÃO</div>");
  });
});

describe("openPromotionBannerTab", () => {
  // O jsdom não tem `URL.createObjectURL`; a dublê devolve a URL que a aba recebe.
  const createObjectURL = vi.fn((_blob: Blob) => "blob:folha");
  const revokeObjectURL = vi.fn((_url: string) => undefined);
  Object.defineProperty(URL, "createObjectURL", {
    value: createObjectURL,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    value: revokeObjectURL,
    configurable: true,
    writable: true,
  });

  afterEach(() => {
    vi.restoreAllMocks();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it("abre a folha numa aba nova a partir de um blob HTML", () => {
    const open = vi.spyOn(window, "open").mockReturnValue({} as Window);

    expect(openPromotionBannerTab("<html></html>")).toBe(true);

    expect(open).toHaveBeenCalledWith("blob:folha", "_blank");
    expect(createObjectURL.mock.calls[0][0].type).toBe("text/html;charset=utf-8");
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it("devolve false quando o navegador bloqueia a aba, e descarta o blob", () => {
    vi.spyOn(window, "open").mockReturnValue(null);

    expect(openPromotionBannerTab("<html></html>")).toBe(false);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:folha");
  });
});

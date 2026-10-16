import { afterEach, describe, expect, it, vi } from "vitest";
import {
  BANNERS_PER_PAGE,
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
    expect(bannerPriceFontSizePt("9")).toBe(130);
    expect(bannerPriceFontSizePt("99")).toBe(100);
    expect(bannerPriceFontSizePt("199")).toBe(80);
    expect(bannerPriceFontSizePt("1.234")).toBe(62);
    expect(bannerPriceFontSizePt("12.345")).toBe(50);
  });
});

describe("bannerTitleFontSizePt", () => {
  it("'PROMOÇÃO' sai no teto de 34pt, e título mais longo encolhe até o piso", () => {
    expect(bannerTitleFontSizePt("PROMOÇÃO")).toBe(34);
    expect(bannerTitleFontSizePt("OFERTA")).toBe(34);
    expect(bannerTitleFontSizePt("LIQUIDAÇÃO")).toBe(32);
    expect(bannerTitleFontSizePt("QUEIMA DE ESTOQUE")).toBe(19);
    expect(bannerTitleFontSizePt("A".repeat(40))).toBe(12);
  });
});

describe("bannerNameStyle", () => {
  it("nome longo encolhe e ganha linhas", () => {
    expect(bannerNameStyle("COPO AMERICANO")).toEqual({ fontSizePt: 22, lines: 2 });
    expect(bannerNameStyle("NOME DO PRODUTO COMPLETO")).toEqual({ fontSizePt: 18, lines: 3 });
    expect(bannerNameStyle("CONJUNTO DE POTES DE VIDRO HERMETICO 3 PECAS")).toEqual({
      fontSizePt: 15,
      lines: 3,
    });
    expect(bannerNameStyle("CONJUNTO DE POTES DE VIDRO HERMETICO RETANGULAR COM TAMPA 3 UNIDADES")).toEqual({
      fontSizePt: 12.5,
      lines: 4,
    });
  });

  it("palavra única e longa encolhe para caber numa linha, em vez de quebrar no meio", () => {
    expect(bannerNameStyle("DESENGORDURANTE")).toEqual({ fontSizePt: 20, lines: 2 });
    expect(bannerNameStyle("SUPERDESENGORDURANTE CONCENTRADO")).toEqual({ fontSizePt: 15, lines: 3 });
  });
});

describe("buildPromotionBannerSheetHtml", () => {
  it("repete o banner conforme as cópias e fecha a folha a cada quatro", () => {
    const html = buildPromotionBannerSheetHtml([
      banner({ copies: 3 }),
      banner({ productName: "ESMALTE", copies: 2 }),
    ]);

    expect(contar(html, 'class="banner"')).toBe(5);
    expect(contar(html, 'class="page"')).toBe(Math.ceil(5 / BANNERS_PER_PAGE));
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
    expect(html).toContain('<span style="font-size:130pt;">9</span>');
    expect(html).toContain('<span style="font-size:65pt;">,90</span>');
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
      buildPromotionBannerSheetHtml([banner({ copies: 5 })]),
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

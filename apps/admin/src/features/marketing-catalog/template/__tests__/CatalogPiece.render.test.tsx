// @vitest-environment node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import satori from "satori";
import type { StorefrontProductDto } from "@workspace/api-client-react";
import type { CatalogCard, PieceData } from "../../types";
import { CatalogPiece } from "../CatalogPiece";
import { FEED, PAGE, STORY, type PieceSpec } from "../geometry";

/**
 * O molde passa pelo satori DE VERDADE.
 *
 * O satori desenha um subconjunto do CSS e recusa o resto com exceção: um `div`
 * com dois filhos sem `display: flex` derruba a geração inteira, e isso só
 * aparece ao gerar — o navegador renderiza o mesmo JSX sem reclamar. Este teste
 * é o que avisa antes do dono tocar em "Gerar".
 *
 * **Prévia sem abrir o navegador:** com `CATALOG_PREVIEW_DIR` definido, o último
 * teste busca produtos reais na vitrine pública e grava o PNG das três peças
 * naquela pasta. É o jeito de conferir uma mudança de desenho:
 *
 *   CATALOG_PREVIEW_DIR=../../../TEMP/catalogo npx vitest run CatalogPiece.render
 */

const require = createRequire(import.meta.url);
const FONT_DIR = path.join(path.dirname(require.resolve("@fontsource/montserrat/package.json")), "files");
const ASSET_DIR = path.resolve(import.meta.dirname, "../../assets");

const WEIGHTS = [500, 600, 700, 800, 900] as const;

async function loadFonts() {
  return Promise.all(
    WEIGHTS.map(async (weight) => ({
      name: "Montserrat",
      weight,
      style: "normal" as const,
      data: await readFile(path.join(FONT_DIR, `montserrat-latin-${weight}-normal.woff`)),
    })),
  );
}

async function dataUrl(file: string, mime: string): Promise<string> {
  return `data:${mime};base64,${(await readFile(file)).toString("base64")}`;
}

/** PNG de 1x1: o satori só precisa de uma imagem válida para montar o card. */
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function card(id: number, overrides: Partial<CatalogCard> = {}): CatalogCard {
  return {
    productGroupId: id,
    name: `PRODUTO ${id}`,
    price: 9.9,
    hasPriceRange: false,
    role: "regular",
    photo: PIXEL,
    ...overrides,
  };
}

/** O arquivo da arte do cabeçalho de cada peça; o do rodapé é o mesmo nas três. */
const HEADER_ART = new Map<PieceSpec, string>([
  [STORY, "story-header.jpg"],
  [FEED, "feed-header.jpg"],
  [PAGE, "page-header.jpg"],
]);

async function pieceData(cards: CatalogCard[], spec: PieceSpec = STORY): Promise<PieceData> {
  return {
    title: "Novidades e promoções",
    cards,
    store: {
      address: "Rua Paranaguá, 663 · Centro · Tapira-PR",
      whatsapp: "(44) 99136-5567",
      site: "uaus.com.br",
    },
    date: new Date("2026-10-03T15:00:00Z"),
    art: {
      header: await dataUrl(path.join(ASSET_DIR, HEADER_ART.get(spec)!), "image/jpeg"),
      footer: await dataUrl(path.join(ASSET_DIR, "story-footer.jpg"), "image/jpeg"),
    },
  };
}

async function renderSvg(data: PieceData, spec: PieceSpec = STORY): Promise<string> {
  return satori(<CatalogPiece spec={spec} {...data} />, {
    width: spec.width,
    height: spec.height,
    fonts: await loadFonts(),
  });
}

describe("conteúdo do molde", () => {
  /** O que o molde escreve, lido como HTML — sem passar pelo desenho. */
  async function html(
    cards: CatalogCard[],
    overrides: Partial<PieceData> = {},
    spec: PieceSpec = STORY,
  ): Promise<string> {
    return renderToStaticMarkup(
      <CatalogPiece spec={spec} {...await pieceData(cards, spec)} {...overrides} />,
    );
  }

  it("toda peça sai com o aviso de preços e de imagens, datado", async () => {
    expect(await html([card(1)])).toContain(
      "Preços de referência em 03/10/2026, sujeitos a alteração sem aviso e à disponibilidade de estoque. " +
        "Imagens meramente ilustrativas.",
    );
  });

  it("a oferta mostra o 'de' com o valor riscado e o selo; o produto comum, não", async () => {
    const markup = await html([card(1, { badge: "offer", referencePrice: 15 }), card(2)]);

    // Riscado é só o valor, como no site: "de" + R$ 15,00 cortado.
    expect(markup.match(/line-through[^>]*>R\$ 15,00</g)).toHaveLength(1);
    expect(markup.match(/>de</g)).toHaveLength(1);
    expect(markup.match(/OFERTA/g)).toHaveLength(1);
  });

  it("grupo com faixa de preço diz 'a partir de'", async () => {
    expect(await html([card(1, { hasPriceRange: true })])).toContain(">a partir de<");
    expect(await html([card(1)])).not.toContain("a partir de");
  });

  it("oferta em grupo com faixa de preço mostra o 'de' riscado E o 'a partir de'", async () => {
    // Variações de R$ 10 e R$ 16 com 20% de desconto custam de R$ 8,00 a
    // R$ 12,80. Só "de R$ 10,00" sobre o R$ 8,00 prometeria o menor preço para
    // todas — o site (`PriceTag`) mostra as duas legendas, e a peça também.
    const markup = await html([card(1, { price: 8, referencePrice: 10, hasPriceRange: true })]);

    expect(markup).toMatch(/line-through[^>]*>R\$ 10,00</);
    expect(markup).toContain("a partir de");
  });

  it("cada selo sai com o próprio texto", async () => {
    const markup = await html([card(1, { badge: "new" }), card(2, { badge: "lastUnits" })]);

    expect(markup).toContain("NOVIDADE");
    expect(markup).toContain("ÚLTIMAS UNIDADES");
  });

  it("a página do catálogo leva 6 produtos e a legenda 'Página 2 de 4'; o banner não tem legenda", async () => {
    const cards = Array.from({ length: 8 }, (_, index) => card(index + 1));
    const page = await html(cards, { caption: "Página 2 de 4" }, PAGE);

    expect(page).toContain("Página 2 de 4");
    expect(page).toContain("PRODUTO 6");
    expect(page).not.toContain("PRODUTO 7");
    expect(await html(cards)).not.toContain("Página");
  });

  it("na página do PDF título e paginação encostam à direita; no banner, ficam centralizados", async () => {
    const page = await html([card(1)], { caption: "Página 2 de 4" }, PAGE);
    const banner = await html([card(1)]);

    // A caixa do título alinha os dois filhos (título e legenda) pelo mesmo lado.
    expect(page).toMatch(/align-items:flex-end[^>]*>(?:(?!<div).)*<div[^>]*text-align:right[^>]*>NOVIDADES/i);
    expect(page).toContain("Página 2 de 4");
    expect(banner).not.toContain("align-items:flex-end");
    expect(banner).toMatch(/text-align:center[^>]*>Novidades e promoções/i);
  });

  it("o aviso de preços vai em TODAS as peças, inclusive em cada página do PDF", async () => {
    for (const spec of [STORY, FEED, PAGE]) {
      expect(await html([card(1)], {}, spec)).toContain("Imagens meramente ilustrativas.");
    }
  });

  it("desenha no máximo 9 produtos, na ordem recebida", async () => {
    const cards = Array.from({ length: 12 }, (_, index) => card(index + 1));
    const markup = await html(cards);

    expect(markup).toContain("PRODUTO 9");
    expect(markup).not.toContain("PRODUTO 10");
    expect(markup.indexOf("PRODUTO 1<")).toBeLessThan(markup.indexOf("PRODUTO 2<"));
  });

  it("contato vazio não imprime rótulo solto", async () => {
    const markup = await html([card(1)], { store: { address: "", whatsapp: "", site: "uaus.com.br" } });

    expect(markup).not.toContain("WhatsApp");
    expect(markup).toContain("uaus.com.br");
  });
});

describe("molde do banner 9:16 no satori", () => {
  it("desenha o banner cheio, com os três selos e as três legendas de preço", async () => {
    const cards = [
      card(1, { badge: "offer", referencePrice: 15, price: 9.99 }),
      card(2, { badge: "new" }),
      card(3, { badge: "lastUnits" }),
      card(4, { hasPriceRange: true }),
      card(5, { badge: "offer", referencePrice: 10, price: 8, hasPriceRange: true }),
      ...[6, 7, 8, 9].map((id) => card(id)),
    ];

    const svg = await renderSvg(await pieceData(cards));

    expect(svg.startsWith(`<svg width="${STORY.width}" height="${STORY.height}"`)).toBe(true);
  });

  it.each([1, 2, 4, 5, 6, 7])("desenha com %i produto(s), que mudam a grade", async (count) => {
    const cards = Array.from({ length: count }, (_, index) => card(index + 1));

    await expect(renderSvg(await pieceData(cards))).resolves.toContain("<svg");
  });

  it("aguenta o maior nome do catálogo (63 caracteres) e preço de quatro dígitos", async () => {
    const cards = [
      card(1, { name: "CONJUNTO POTES HERMETICOS DE VIDRO COM TAMPA DE BAMBU 5 PECAS XL", price: 1234.5 }),
      ...[2, 3, 4, 5, 6, 7, 8, 9].map((id) => card(id)),
    ];

    await expect(renderSvg(await pieceData(cards))).resolves.toContain("<svg");
  });

  it("desenha sem endereço e sem WhatsApp, só com o aviso", async () => {
    const data = await pieceData([card(1), card(2), card(3)]);

    await expect(renderSvg({ ...data, store: { address: "", whatsapp: "", site: "" } })).resolves.toContain(
      "<svg",
    );
  });

  it.runIf(process.env.CATALOG_PREVIEW_DIR)(
    "grava a prévia com produtos reais da vitrine",
    async () => {
      const { Resvg, initWasm } = await import("@resvg/resvg-wasm");
      const { toCatalogProducts } = await import("../../lib/catalogProducts");
      await initWasm(readFile(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));

      // A vitrine PÚBLICA, e não o sorteio: `/Catalogs/draw` exige sessão, e a
      // prévia serve para olhar o desenho, não a escolha. `CATALOG_PREVIEW_SEED`
      // desloca a janela de produtos, para ver cards diferentes.
      const api = process.env.CATALOG_PREVIEW_API ?? "https://api.uaus.com.br";
      const page = await (await fetch(`${api}/Storefront/products?size=60`)).json();
      const offset = Number(process.env.CATALOG_PREVIEW_SEED ?? 0) % 40;
      const products = toCatalogProducts(
        page.items
          .slice(offset, offset + 18)
          .map((product: StorefrontProductDto) => ({ role: "Regular", product })),
      );

      // Aqui não há o canvas do navegador para normalizar a foto, então só entra
      // o que o satori lê cru: JPEG e PNG de verdade, conferidos pelos primeiros
      // bytes — a extensão mente (há `.jpg` no bucket que é WebP por dentro).
      const loaded = await Promise.all(
        products.map(async ({ imageUrl, ...rest }) => {
          const bytes = Buffer.from(await (await fetch(imageUrl)).arrayBuffer());
          const mime =
            bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg" : bytes[0] === 0x89 ? "image/png" : null;
          return mime ? { ...rest, photo: `data:${mime};base64,${bytes.toString("base64")}` } : null;
        }),
      );
      const cards = loaded.filter((item) => item !== null).slice(0, 9);

      const dir = path.resolve(process.env.CATALOG_PREVIEW_DIR!);
      await mkdir(dir, { recursive: true });

      const pieces: Array<[string, PieceSpec, string | undefined]> = [
        ["banner-story.png", STORY, undefined],
        ["banner-feed.png", FEED, undefined],
        ["catalogo-pagina.png", PAGE, "Página 1 de 4"],
      ];
      for (const [file, spec, caption] of pieces) {
        const data = {
          ...(await pieceData(cards.slice(0, spec.maxProducts), spec)),
          caption,
          date: new Date(),
        };
        const svg = await renderSvg(data, spec);
        const png = new Resvg(svg, { fitTo: { mode: "width", value: spec.width } }).render().asPng();

        await writeFile(path.join(dir, file), png);
        expect(png.byteLength).toBeGreaterThan(50_000);
      }
    },
    60_000,
  );
});

describe("molde do banner 4:5 no satori", () => {
  it.each([1, 3, 4, 6])("desenha com %i produto(s)", async (count) => {
    const cards = Array.from({ length: count }, (_, index) => card(index + 1, { badge: "new" }));
    const svg = await renderSvg(await pieceData(cards, FEED), FEED);

    expect(svg.startsWith(`<svg width="${FEED.width}" height="${FEED.height}"`)).toBe(true);
  });
});

describe("molde da página do catálogo em PDF no satori", () => {
  it("desenha a página cheia, com legenda, selos e as legendas de preço", async () => {
    const cards = [
      card(1, { badge: "offer", referencePrice: 15, price: 9.99 }),
      card(2, { badge: "new" }),
      card(3, { badge: "lastUnits" }),
      card(4, { hasPriceRange: true }),
      card(5, { badge: "offer", referencePrice: 10, price: 8, hasPriceRange: true }),
      card(6, { name: "CONJUNTO POTES HERMETICOS DE VIDRO COM TAMPA DE BAMBU 5 PECAS XL", price: 1234.5 }),
    ];
    const data = {
      ...(await pieceData(cards, PAGE)),
      caption: "Página 1 de 4",
      title: "Utilidades de cozinha e mesa posta",
    };

    const svg = await renderSvg(data, PAGE);

    expect(svg.startsWith(`<svg width="${PAGE.width}" height="${PAGE.height}"`)).toBe(true);
  });

  it.each([1, 2, 3, 5])("desenha a última página com %i produto(s)", async (count) => {
    const cards = Array.from({ length: count }, (_, index) => card(index + 1));
    const data = { ...(await pieceData(cards, PAGE)), caption: "Página 4 de 4" };

    await expect(renderSvg(data, PAGE)).resolves.toContain("<svg");
  });
});

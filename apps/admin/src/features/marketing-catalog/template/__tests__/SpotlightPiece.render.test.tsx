// @vitest-environment node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import satori from "satori";
import type { CatalogCard, SpotlightData, SpotlightFormat, SpotlightKind } from "../../types";
import { SpotlightPiece } from "../SpotlightPiece";
import { SPOTLIGHT_SPECS } from "../spotlightGeometry";

/**
 * O molde do banner de destaque (04/11/2026) passa pelo satori DE VERDADE, como
 * o do catálogo (`CatalogPiece.render.test.tsx`): o subconjunto de CSS que ele
 * aceita só reclama ao gerar, e o navegador renderiza o mesmo JSX calado.
 *
 * **Prévia sem abrir o navegador:** com `CATALOG_PREVIEW_DIR`, o último teste
 * grava os dois tamanhos em PNG, com uma foto de amostra:
 *
 *   CATALOG_PREVIEW_DIR=../../../TEMP/catalogo npx vitest run SpotlightPiece.render
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

/** PNG de 1x1: o satori só precisa de uma imagem válida. */
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function card(overrides: Partial<CatalogCard> = {}): CatalogCard {
  return {
    productGroupId: 7,
    name: "GARRAFA TÉRMICA INOX 500ML COM ALÇA",
    price: 24.9,
    hasPriceRange: false,
    role: "new",
    photo: PIXEL,
    ...overrides,
  };
}

async function data(
  format: SpotlightFormat,
  kind: SpotlightKind,
  overrides: Partial<SpotlightData> = {},
): Promise<SpotlightData> {
  return {
    kind,
    title: "Chegou novidade!",
    card: card(),
    photoSize: { width: 1080, height: 1080 },
    notes: [],
    store: {
      address: "Rua Paranaguá, 663 · Centro · Tapira-PR",
      whatsapp: "(44) 99136-5567",
      site: "uaus.com.br",
    },
    date: new Date("2026-11-04T15:00:00Z"),
    art: {
      header: await dataUrl(path.join(ASSET_DIR, `${format}-header.jpg`), "image/jpeg"),
      footer: await dataUrl(path.join(ASSET_DIR, "story-footer.jpg"), "image/jpeg"),
    },
    ...overrides,
  };
}

async function html(format: SpotlightFormat, kind: SpotlightKind, overrides: Partial<SpotlightData> = {}) {
  return renderToStaticMarkup(
    <SpotlightPiece spec={SPOTLIGHT_SPECS[format]} {...await data(format, kind, overrides)} />,
  );
}

async function svg(format: SpotlightFormat, value: SpotlightData): Promise<string> {
  const spec = SPOTLIGHT_SPECS[format];
  return satori(<SpotlightPiece spec={spec} {...value} />, {
    width: spec.width,
    height: spec.height,
    fonts: await loadFonts(),
  });
}

describe("conteúdo do banner de destaque", () => {
  it("o selo é o do tipo: PROMOÇÃO, NOVIDADE ou REPOSIÇÃO", async () => {
    expect(await html("story", "offer")).toContain("PROMOÇÃO");
    expect(await html("story", "new")).toContain("NOVIDADE");
    expect(await html("story", "restock")).toContain("REPOSIÇÃO");
    expect(await html("story", "restock")).not.toContain("NOVIDADE");
  });

  it("no combo, o selo promocional diz a oferta no lugar da palavra", async () => {
    const markup = await html("feed", "offer", { card: card({ comboOffer: "3 por R$ 20,00" }) });

    expect(markup).toContain("3 POR R$ 20,00");
    expect(markup).not.toContain(">PROMOÇÃO<");
  });

  it("o preço promocional leva o 'de' riscado, e o grupo com faixa o 'a partir de'", async () => {
    const markup = await html("story", "new", {
      card: card({ price: 19.9, referencePrice: 24.9, hasPriceRange: true }),
    });

    expect(markup).toMatch(/line-through[^>]*>R\$ 24,90</);
    expect(markup).toContain("a partir de");
  });

  it("a validade e o limite vão abaixo do preço; o aviso de preços, no rodapé", async () => {
    const markup = await html("story", "offer", { notes: ["Válida até 08/11", "Limite de 3 por cliente"] });

    expect(markup).toContain("Válida até 08/11");
    expect(markup).toContain("Limite de 3 por cliente");
    expect(markup).toContain("Preços de referência em 04/11/2026");
  });

  it("a foto pequena não passa de duas vezes o tamanho dela", async () => {
    const markup = await html("story", "new", { photoSize: { width: 225, height: 225 } });

    expect(markup).toMatch(/<img src="data:image\/png[^"]*" width="450" height="450"/);
  });
});

describe("banner de destaque no satori", () => {
  it.each([
    ["story", "offer"],
    ["story", "new"],
    ["story", "restock"],
    ["feed", "offer"],
    ["feed", "new"],
    ["feed", "restock"],
  ] as const)("desenha o %s do tipo %s", async (format, kind) => {
    const spec = SPOTLIGHT_SPECS[format];
    const result = await svg(format, await data(format, kind));

    expect(result.startsWith(`<svg width="${spec.width}" height="${spec.height}"`)).toBe(true);
  });

  it.each(["story", "feed"] as const)(
    "o %s aguenta o maior nome, o preço de quatro dígitos, o combo e as duas linhas",
    async (format) => {
      const value = await data(format, "offer", {
        title: "Utilidades de cozinha e mesa posta",
        card: card({
          name: "CONJUNTO POTES HERMETICOS DE VIDRO COM TAMPA DE BAMBU 5 PECAS XL",
          price: 1234.5,
          referencePrice: 1500,
          hasPriceRange: true,
          comboOffer: "3 por R$ 20,00",
        }),
        notes: ["Válida até 10/01/2027", "Limite de 3 por cliente"],
        photoSize: { width: 300, height: 1600 },
      });

      await expect(svg(format, value)).resolves.toContain("<svg");
    },
  );

  it.runIf(process.env.CATALOG_PREVIEW_DIR)(
    "grava a prévia dos dois tamanhos",
    async () => {
      const { Resvg, initWasm } = await import("@resvg/resvg-wasm");
      await initWasm(readFile(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));

      // A arte do cabeçalho faz as vezes de foto: é um JPEG de verdade, com tamanho.
      const photo = await dataUrl(path.join(ASSET_DIR, "story-header.jpg"), "image/jpeg");
      const dir = path.resolve(process.env.CATALOG_PREVIEW_DIR!);
      await mkdir(dir, { recursive: true });

      for (const format of ["story", "feed"] as const) {
        const value = await data(format, "offer", {
          title: "Promoção",
          card: card({ photo, price: 19.9, referencePrice: 24.9 }),
          photoSize: { width: 1080, height: 480 },
          notes: ["Válida até 08/11", "Limite de 3 por cliente"],
        });
        const png = new Resvg(await svg(format, value), {
          fitTo: { mode: "width", value: SPOTLIGHT_SPECS[format].width },
        })
          .render()
          .asPng();

        await writeFile(path.join(dir, `destaque-${format}.png`), png);
        expect(png.byteLength).toBeGreaterThan(50_000);
      }
    },
    60_000,
  );
});

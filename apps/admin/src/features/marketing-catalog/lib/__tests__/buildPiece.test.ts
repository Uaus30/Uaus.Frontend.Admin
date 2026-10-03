// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PieceKind } from "../../template/geometry";
import type { CatalogProduct, PieceData } from "../../types";
import { CATALOG_FORMATS } from "../formats";

/**
 * A montagem da peça, sem o desenho: fotos, renderizador e canvas são dublados
 * (um precisa de rede, outro de WebAssembly, outro do navegador). O que se
 * confere aqui é o que a montagem DECIDE — quem entra, em que página, com que
 * link — e o PDF que sai é o de verdade, escrito pelo `pdfWriter`.
 */

const mocks = vi.hoisted(() => ({
  loadPhoto: vi.fn(),
  loadAssetAsDataUrl: vi.fn(),
  pixelsToJpegBlob: vi.fn(),
  renderPiece: vi.fn(),
  preloadRenderer: vi.fn(),
}));

vi.mock("../photos", () => ({
  loadPhoto: mocks.loadPhoto,
  loadAssetAsDataUrl: mocks.loadAssetAsDataUrl,
  pixelsToJpegBlob: mocks.pixelsToJpegBlob,
}));

vi.mock("../renderer", () => ({
  renderPiece: mocks.renderPiece,
  preloadRenderer: mocks.preloadRenderer,
}));

const { buildPiece, clearPageCacheForTests } = await import("../buildPiece");

function product(id: number): CatalogProduct {
  return {
    productGroupId: id,
    name: `PRODUTO ${id}`,
    price: 10,
    hasPriceRange: false,
    imageUrl: `https://bucket.exemplo/${id}.jpg`,
    role: "regular",
  };
}

const products = (ids: number[]) => ids.map(product);
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** Meio-dia de Brasília: longe da virada do dia, que é outro teste. */
const DATE = new Date("2026-10-03T15:00:00Z");

/** As páginas pedidas ao renderizador, na ordem. */
const rendered = () =>
  mocks.renderPiece.mock.calls.map(
    ([kind, data]) => ({ kind, data }) as { kind: PieceKind; data: PieceData },
  );

const asText = async (blob: Blob) => Buffer.from(await blob.arrayBuffer()).toString("latin1");

describe("buildPiece", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPageCacheForTests();

    mocks.loadAssetAsDataUrl.mockImplementation(async (url: string) => `data:arte;${url}`);
    // Foto grande por padrão; o teste que precisa de outra troca por URL.
    mocks.loadPhoto.mockImplementation(async (url: string) => ({
      dataUrl: `data:foto;${url}`,
      width: 800,
      height: 800,
    }));
    mocks.renderPiece.mockImplementation(async (_kind: PieceKind, data: PieceData) => ({
      data: new Uint8ClampedArray(4),
      width: 1,
      height: 1,
      // Só para o dublê do canvas saber de que página são os pixels.
      label: data.cards.map((card) => card.productGroupId).join(","),
    }));
    mocks.pixelsToJpegBlob.mockImplementation(
      async (pixels: { label: string }) => new Blob([`JPEG[${pixels.label}]`], { type: "image/jpeg" }),
    );
  });

  // ------------------------------------------------------------- banner

  it("o banner é uma página só, e o arquivo é o próprio JPEG dela", async () => {
    const result = await buildPiece({
      format: CATALOG_FORMATS.story,
      title: "Destaques da loja",
      candidates: products(range(1, 9)),
      count: 9,
      date: DATE,
    });

    expect(rendered()).toHaveLength(1);
    expect(rendered()[0].kind).toBe("story");
    expect(rendered()[0].data.caption).toBeUndefined();
    expect(result.pages).toHaveLength(1);
    expect(result.blob).toBe(result.pages[0]);
    expect(result.products.map((item) => item.productGroupId)).toEqual(range(1, 9));
  });

  it("o banner 4:5 usa o molde e a arte dele", async () => {
    await buildPiece({
      format: CATALOG_FORMATS.feed,
      title: "Destaques",
      candidates: products(range(1, 6)),
      count: 6,
      date: DATE,
    });

    expect(rendered()[0].kind).toBe("feed");
    expect(rendered()[0].data.art.header).toContain("feed-header");
    expect(rendered()[0].data.art.footer).toContain("story-footer");
  });

  it("foto fora do ar cede a vaga à reserva, e a peça sai completa", async () => {
    mocks.loadPhoto.mockImplementation(async (url: string) => {
      if (url.endsWith("/2.jpg")) throw new Error("404");
      return { dataUrl: `data:foto;${url}`, width: 800, height: 800 };
    });

    const result = await buildPiece({
      format: CATALOG_FORMATS.story,
      title: "Destaques",
      candidates: products([1, 2, 3, 20]),
      count: 3,
      date: DATE,
    });

    expect(result.products.map((item) => item.productGroupId)).toEqual([1, 3, 20]);
  });

  it("o banner aceita a miniatura de 225 px — nele o card é pequeno", async () => {
    mocks.loadPhoto.mockResolvedValue({ dataUrl: "data:foto", width: 225, height: 225 });

    const result = await buildPiece({
      format: CATALOG_FORMATS.story,
      title: "Destaques",
      candidates: products([1, 2]),
      count: 2,
      date: DATE,
    });

    expect(result.products).toHaveLength(2);
  });

  it("sem nenhuma foto, o erro diz o que fazer", async () => {
    mocks.loadPhoto.mockRejectedValue(new Error("sem rede"));

    await expect(
      buildPiece({
        format: CATALOG_FORMATS.story,
        title: "x",
        candidates: products([1, 2]),
        count: 2,
        date: DATE,
      }),
    ).rejects.toThrow(/Nenhuma foto de produto pôde ser carregada/);
    expect(mocks.renderPiece).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------- PDF

  it("o catálogo parte os produtos em páginas de 6, numeradas", async () => {
    const result = await buildPiece({
      format: CATALOG_FORMATS.pdf,
      title: "Brinquedos",
      candidates: products(range(1, 14)),
      count: 14,
      date: DATE,
    });

    const pages = rendered();
    expect(pages.map((page) => page.kind)).toEqual(["page", "page", "page"]);
    expect(pages.map((page) => page.data.cards.length)).toEqual([6, 6, 2]);
    expect(pages.map((page) => page.data.caption)).toEqual([
      "Página 1 de 3",
      "Página 2 de 3",
      "Página 3 de 3",
    ]);
    expect(pages[0].data.art.header).toContain("page-header");

    expect(result.pages).toHaveLength(3);
    expect(result.blob.type).toBe("application/pdf");
  });

  it("catálogo de uma página só não imprime 'Página 1 de 1'", async () => {
    await buildPiece({
      format: CATALOG_FORMATS.pdf,
      title: "Achados",
      candidates: products(range(1, 5)),
      count: 5,
      date: DATE,
    });

    expect(rendered()[0].data.caption).toBeUndefined();
  });

  it("o PDF recusa foto com o menor lado abaixo de 300 px e põe a reserva no lugar", async () => {
    mocks.loadPhoto.mockImplementation(async (url: string) => {
      // A 2 é a miniatura do Mais PDV; a 3 é comprida, com o menor lado em 299.
      if (url.endsWith("/2.jpg")) return { dataUrl: "data:p", width: 225, height: 225 };
      if (url.endsWith("/3.jpg")) return { dataUrl: "data:c", width: 1600, height: 299 };
      // No limite já serve.
      if (url.endsWith("/4.jpg")) return { dataUrl: "data:l", width: 300, height: 300 };
      return { dataUrl: `data:foto;${url}`, width: 800, height: 800 };
    });

    const result = await buildPiece({
      format: CATALOG_FORMATS.pdf,
      title: "Cozinha",
      candidates: products([1, 2, 3, 4, 20, 21]),
      count: 4,
      date: DATE,
    });

    expect(result.products.map((item) => item.productGroupId)).toEqual([1, 4, 20, 21]);
  });

  it("se nenhuma foto do sorteio serve para o PDF, o erro explica que é o tamanho", async () => {
    mocks.loadPhoto.mockResolvedValue({ dataUrl: "data:p", width: 225, height: 225 });

    await expect(
      buildPiece({
        format: CATALOG_FORMATS.pdf,
        title: "x",
        candidates: products([1, 2]),
        count: 2,
        date: DATE,
      }),
    ).rejects.toThrow(/foto grande o bastante/);
  });

  it("o PDF leva as páginas na ordem, e cada produto com o link dele para o site", async () => {
    const result = await buildPiece({
      format: CATALOG_FORMATS.pdf,
      title: "Promoções",
      candidates: products(range(1, 8)),
      count: 8,
      date: DATE,
    });

    const pdf = await asText(result.blob);

    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Type /Pages /Count 2 ");
    // A página de 1080 × 2340 px sai com 540 × 1170 pt.
    expect(pdf.match(/\/MediaBox \[0 0 540 1170\]/g)).toHaveLength(2);
    expect(pdf.indexOf("JPEG[1,2,3,4,5,6]")).toBeLessThan(pdf.indexOf("JPEG[7,8]"));

    const links = [...pdf.matchAll(/\/URI \(([^)]+)\)/g)].map((match) => match[1]);
    expect(links).toEqual(
      range(1, 8).map(
        (id) =>
          `https://uaus.com.br/produtos/${id}?utm_source=whatsapp&utm_medium=catalogo&utm_campaign=catalogo-2026-10-03`,
      ),
    );

    // O 1º card da página: esquerda 16, base 1170 − (260 + 610)/2 = 735, direita 265, topo 1040.
    expect(pdf).toContain("/Rect [16 735 265 1040]");
  });

  it("avisa em que página o desenho está, antes de cada uma", async () => {
    const onProgress = vi.fn();

    await buildPiece({
      format: CATALOG_FORMATS.pdf,
      title: "Brinquedos",
      candidates: products(range(1, 13)),
      count: 13,
      date: DATE,
      onProgress,
    });

    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { page: 1, pages: 3 },
      { page: 2, pages: 3 },
      { page: 3, pages: 3 },
    ]);
  });

  // -------------------------------------------------- páginas guardadas

  it("trocar UM produto do catálogo redesenha só a página dele", async () => {
    const request = {
      format: CATALOG_FORMATS.pdf,
      title: "Brinquedos",
      candidates: products(range(1, 18)),
      count: 18,
      date: DATE,
    };
    await buildPiece(request);
    expect(mocks.renderPiece).toHaveBeenCalledTimes(3);

    // O 8 (2ª página) sai e entra o 50.
    const swapped = range(1, 18).map((id) => (id === 8 ? 50 : id));
    const result = await buildPiece({ ...request, candidates: products(swapped) });

    expect(mocks.renderPiece).toHaveBeenCalledTimes(4);
    expect(rendered()[3].data.cards.map((card) => card.productGroupId)).toEqual([7, 50, 9, 10, 11, 12]);
    expect(result.pages).toHaveLength(3);
  });

  it("título novo é outra página: redesenha todas", async () => {
    const request = {
      format: CATALOG_FORMATS.pdf,
      title: "Brinquedos",
      candidates: products(range(1, 12)),
      count: 12,
      date: DATE,
    };
    await buildPiece(request);
    await buildPiece({ ...request, title: "Semana das crianças" });

    expect(mocks.renderPiece).toHaveBeenCalledTimes(4);
  });

  it("preço que mudou entre um desenho e outro não reaproveita a página velha", async () => {
    const request = {
      format: CATALOG_FORMATS.story,
      title: "Destaques",
      candidates: products([1, 2]),
      count: 2,
      date: DATE,
    };
    await buildPiece(request);
    await buildPiece({ ...request, candidates: [{ ...product(1), price: 12 }, product(2)] });

    expect(mocks.renderPiece).toHaveBeenCalledTimes(2);
  });

  it("página que falhou não fica guardada: a tentativa seguinte desenha de novo", async () => {
    const request = {
      format: CATALOG_FORMATS.story,
      title: "Destaques",
      candidates: products([1, 2]),
      count: 2,
      date: DATE,
    };
    mocks.renderPiece.mockRejectedValueOnce(new Error("sem memória"));

    await expect(buildPiece(request)).rejects.toThrow("sem memória");
    await expect(buildPiece(request)).resolves.toMatchObject({
      products: [{ productGroupId: 1 }, { productGroupId: 2 }],
    });
  });
});

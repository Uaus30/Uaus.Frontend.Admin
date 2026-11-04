// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogProduct, SpotlightData } from "../../types";
import { HEADER_ART } from "../art";
import { SPOTLIGHT_PHOTO_MAX_SIDE } from "../photos";

/**
 * A montagem do banner de destaque, sem o desenho: fotos, renderizador e canvas
 * são dublados, como no teste do catálogo. O que se confere é o que a montagem
 * decide — a foto em alta, a arte do tamanho certo e o que vai ao molde.
 */

const mocks = vi.hoisted(() => ({
  loadPhoto: vi.fn(),
  loadAssetAsDataUrl: vi.fn(),
  pixelsToJpegBlob: vi.fn(),
  renderSpotlight: vi.fn(),
}));

vi.mock("../photos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../photos")>()),
  loadPhoto: mocks.loadPhoto,
  loadAssetAsDataUrl: mocks.loadAssetAsDataUrl,
  pixelsToJpegBlob: mocks.pixelsToJpegBlob,
}));

vi.mock("../renderer", () => ({ renderSpotlight: mocks.renderSpotlight }));

const { buildSpotlight } = await import("../buildSpotlight");

const PRODUCT: CatalogProduct = {
  productGroupId: 7,
  name: "GARRAFA TÉRMICA",
  price: 19.9,
  referencePrice: 24.9,
  hasPriceRange: false,
  imageUrl: "https://bucket.exemplo/7.jpg",
  role: "offer",
};

const DATE = new Date("2026-11-04T15:00:00Z");

describe("buildSpotlight", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.loadAssetAsDataUrl.mockImplementation(async (url: string) => `data:arte;${url}`);
    mocks.loadPhoto.mockResolvedValue({ dataUrl: "data:foto", width: 225, height: 300 });
    mocks.renderSpotlight.mockResolvedValue({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
    mocks.pixelsToJpegBlob.mockResolvedValue(new Blob(["JPEG"], { type: "image/jpeg" }));
  });

  it("baixa a foto em alta, desenha no tamanho pedido e devolve o JPEG e o tamanho da foto", async () => {
    const result = await buildSpotlight({
      format: "feed",
      kind: "offer",
      title: "Promoção",
      product: PRODUCT,
      notes: ["Válida até 08/11"],
      date: DATE,
    });

    expect(mocks.loadPhoto).toHaveBeenCalledWith(PRODUCT.imageUrl, SPOTLIGHT_PHOTO_MAX_SIDE);
    expect(mocks.loadAssetAsDataUrl).toHaveBeenCalledWith(HEADER_ART.feed);

    const [format, data] = mocks.renderSpotlight.mock.calls[0] as [string, SpotlightData];
    expect(format).toBe("feed");
    expect(data).toMatchObject({
      kind: "offer",
      title: "Promoção",
      notes: ["Válida até 08/11"],
      photoSize: { width: 225, height: 300 },
      card: { productGroupId: 7, price: 19.9, referencePrice: 24.9, photo: "data:foto" },
    });
    expect(data.card).not.toHaveProperty("imageUrl");

    expect(result.photo).toEqual({ width: 225, height: 300 });
    expect(await result.blob.text()).toBe("JPEG");
  });

  it("foto que não carrega não vira banner sem foto: o erro diz o que fazer", async () => {
    mocks.loadPhoto.mockRejectedValue(new Error("404"));

    await expect(
      buildSpotlight({
        format: "story",
        kind: "new",
        title: "Novidade",
        product: PRODUCT,
        notes: [],
        date: DATE,
      }),
    ).rejects.toThrow("A foto do produto não carregou");
    expect(mocks.renderSpotlight).not.toHaveBeenCalled();
  });
});

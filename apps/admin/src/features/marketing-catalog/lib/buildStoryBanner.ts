import { createElement } from "react";
import footerArtUrl from "../assets/story-footer.jpg";
import headerArtUrl from "../assets/story-header.jpg";
import { STORY } from "../template/geometry";
import { StoryBanner } from "../template/StoryBanner";
import type { CatalogCard, CatalogProduct } from "../types";
import { loadCatalogFonts } from "./fonts";
import { loadAssetAsDataUrl, loadPhotoAsDataUrl, pixelsToJpegBlob } from "./photos";
import { preloadRenderer, renderToPixels } from "./renderer";
import { CATALOG_STORE } from "./storeContact";

export interface StoryBannerRequest {
  title: string;
  /**
   * Candidatos, em ordem de preferência. Venha com folga: quem tiver a foto
   * fora do ar cede a vaga ao próximo, e o banner não sai com buraco.
   */
  candidates: CatalogProduct[];
  /** Quantos produtos o banner leva. */
  count: number;
  date: Date;
}

export interface StoryBannerResult {
  /** O banner pronto, em JPEG. */
  blob: Blob;
  /** Os produtos que entraram, na ordem em que foram desenhados. */
  products: CatalogProduct[];
}

/**
 * Adianta o que não depende do sorteio — renderizador, fontes e as duas artes —
 * para o primeiro toque em "Gerar" esperar só os produtos e as fotos.
 */
export function preloadStoryBanner(): void {
  preloadRenderer();
  void Promise.all([
    loadCatalogFonts(),
    loadAssetAsDataUrl(headerArtUrl),
    loadAssetAsDataUrl(footerArtUrl),
  ]).catch(() => undefined);
}

/** Junta cada candidato à foto dele; quem falhou sai da lista. */
async function loadCards(
  candidates: CatalogProduct[],
): Promise<Array<{ product: CatalogProduct; card: CatalogCard }>> {
  const photos = await Promise.allSettled(candidates.map((product) => loadPhotoAsDataUrl(product.imageUrl)));

  return candidates.flatMap((product, index) => {
    const photo = photos[index];
    if (photo.status !== "fulfilled") return [];

    const { imageUrl: _imageUrl, ...rest } = product;
    return [{ product, card: { ...rest, photo: photo.value } }];
  });
}

/**
 * Monta o banner 9:16: baixa fontes, artes e fotos, desenha o molde e fecha o
 * arquivo. Tudo no navegador — nada sobe para o servidor.
 */
export async function buildStoryBanner(request: StoryBannerRequest): Promise<StoryBannerResult> {
  const [fonts, header, footer, loaded] = await Promise.all([
    loadCatalogFonts(),
    loadAssetAsDataUrl(headerArtUrl),
    loadAssetAsDataUrl(footerArtUrl),
    loadCards(request.candidates),
  ]);

  const chosen = loaded.slice(0, request.count);
  if (chosen.length === 0) {
    throw new Error("Nenhuma foto de produto pôde ser carregada. Confira a conexão e tente de novo.");
  }

  const element = createElement(StoryBanner, {
    title: request.title,
    cards: chosen.map((item) => item.card),
    store: CATALOG_STORE,
    date: request.date,
    art: { header, footer },
  });

  const pixels = await renderToPixels(element, { width: STORY.width, height: STORY.height }, fonts);

  return { blob: await pixelsToJpegBlob(pixels), products: chosen.map((item) => item.product) };
}

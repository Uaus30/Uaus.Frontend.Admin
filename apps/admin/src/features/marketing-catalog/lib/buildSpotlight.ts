import type { CatalogProduct, SpotlightFormat, SpotlightKind } from "../types";
import { FOOTER_ART, HEADER_ART } from "./art";
import { CATALOG_FORMATS } from "./formats";
import { loadAssetAsDataUrl, loadPhoto, pixelsToJpegBlob, SPOTLIGHT_PHOTO_MAX_SIDE } from "./photos";
import { renderSpotlight } from "./renderer";
import { CATALOG_STORE } from "./storeContact";

export interface SpotlightRequest {
  format: SpotlightFormat;
  kind: SpotlightKind;
  title: string;
  /** O produto, com o nome já reescrito quando a pessoa mexeu. */
  product: CatalogProduct;
  /** As linhas miúdas abaixo do preço ("Válida até 08/11"). */
  notes: string[];
  date: Date;
}

export interface SpotlightResult {
  /** O arquivo: o JPEG do banner. */
  blob: Blob;
  /** O tamanho da foto no arquivo original — abaixo de 300 px a tela avisa. */
  photo: { width: number; height: number };
}

/**
 * Monta o banner de destaque (04/11/2026): baixa as artes e a foto, desenha e
 * fecha o JPEG. Tudo no navegador, pelo mesmo worker do catálogo.
 *
 * Sem reservas: é um produto só, e se a foto não carrega não há banner — o erro
 * diz isso, em vez de sair um banner sem foto.
 */
export async function buildSpotlight(request: SpotlightRequest): Promise<SpotlightResult> {
  const option = CATALOG_FORMATS[request.format];

  const [header, footer, photo] = await Promise.all([
    loadAssetAsDataUrl(HEADER_ART[request.format]),
    loadAssetAsDataUrl(FOOTER_ART),
    loadPhoto(request.product.imageUrl, SPOTLIGHT_PHOTO_MAX_SIDE).catch((error: unknown) => {
      throw new Error("A foto do produto não carregou. Confira a conexão e tente de novo.", { cause: error });
    }),
  ]);

  const { imageUrl: _imageUrl, ...card } = request.product;
  const pixels = await renderSpotlight(request.format, {
    kind: request.kind,
    title: request.title,
    card: { ...card, photo: photo.dataUrl },
    photoSize: { width: photo.width, height: photo.height },
    notes: request.notes,
    store: CATALOG_STORE,
    date: request.date,
    art: { header, footer },
  });

  return {
    blob: await pixelsToJpegBlob(pixels, option.jpegQuality),
    photo: { width: photo.width, height: photo.height },
  };
}

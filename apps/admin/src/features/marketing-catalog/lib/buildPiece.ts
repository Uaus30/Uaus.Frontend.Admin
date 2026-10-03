import feedHeaderUrl from "../assets/feed-header.jpg";
import pageHeaderUrl from "../assets/page-header.jpg";
import footerArtUrl from "../assets/story-footer.jpg";
import storyHeaderUrl from "../assets/story-header.jpg";
import { cardRects, PIECE_SPECS, type PieceKind } from "../template/geometry";
import { formatStoreDate } from "../template/text";
import type { CatalogCard, CatalogProduct, PieceData } from "../types";
import type { CatalogFormatOption } from "./formats";
import { productLink } from "./links";
import { writePdf } from "./pdfWriter";
import { loadAssetAsDataUrl, loadPhoto, pixelsToJpegBlob } from "./photos";
import { preloadRenderer, renderPiece } from "./renderer";
import { CATALOG_STORE } from "./storeContact";

export interface PieceRequest {
  format: CatalogFormatOption;
  title: string;
  /**
   * Candidatos, em ordem de preferência. Venha com folga: quem tiver a foto
   * fora do ar (ou pequena demais para o formato) cede a vaga ao próximo, e a
   * peça não sai com buraco.
   */
  candidates: CatalogProduct[];
  /** Quantos produtos a peça leva. */
  count: number;
  date: Date;
  /** Avisa em que página o desenho está — o catálogo em PDF são várias. */
  onProgress?: (progress: PieceProgress) => void;
}

export interface PieceProgress {
  page: number;
  pages: number;
}

export interface PieceResult {
  /** O arquivo: JPEG no banner, PDF no catálogo. */
  blob: Blob;
  /** Cada página em JPEG — é o que a prévia mostra. No banner, uma só: o próprio arquivo. */
  pages: Blob[];
  /** Os produtos que entraram, na ordem em que foram desenhados. */
  products: CatalogProduct[];
}

/** A arte do cabeçalho muda com a peça; a do rodapé é a mesma nas três. */
const HEADER_ART: Record<PieceKind, string> = {
  story: storyHeaderUrl,
  feed: feedHeaderUrl,
  page: pageHeaderUrl,
};

/** Meio ponto por pixel: a página de 1080 px vira 540 pt, perto da largura de um celular. */
const PDF_POINTS_PER_PIXEL = 0.5;

/**
 * Adianta o que não depende do sorteio — renderizador, fontes e as artes — para
 * o primeiro toque em "Gerar" esperar só os produtos e as fotos.
 */
export function preloadPiece(): void {
  preloadRenderer();
  void Promise.all([footerArtUrl, ...Object.values(HEADER_ART)].map(loadAssetAsDataUrl)).catch(
    () => undefined,
  );
}

interface LoadedCard {
  product: CatalogProduct;
  card: CatalogCard;
}

/** Junta cada candidato à foto dele; quem falhou, ou tem foto pequena demais, sai da lista. */
async function loadCards(candidates: CatalogProduct[], minPhotoSide: number): Promise<LoadedCard[]> {
  const photos = await Promise.allSettled(candidates.map((product) => loadPhoto(product.imageUrl)));

  return candidates.flatMap((product, index) => {
    const photo = photos[index];
    if (photo.status !== "fulfilled") return [];
    if (Math.min(photo.value.width, photo.value.height) < minPhotoSide) return [];

    const { imageUrl: _imageUrl, ...rest } = product;
    return [{ product, card: { ...rest, photo: photo.value.dataUrl } }];
  });
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) groups.push(items.slice(index, index + size));
  return groups;
}

/**
 * As últimas páginas desenhadas, pelo que elas mostram.
 *
 * Trocar UM produto do catálogo em PDF muda uma página de cinco: as outras
 * quatro saem daqui em vez de serem desenhadas de novo (cada uma custa segundos
 * no celular). O teto é o de três catálogos — o que passar disso sai pela ordem
 * de chegada.
 */
const PAGE_CACHE_SIZE = 15;
const pageCache = new Map<string, Promise<Blob>>();

/** Tudo o que muda o desenho de uma página. Mudou qualquer coisa, é outra página. */
function pageKey(kind: PieceKind, data: PieceData): string {
  const cards = data.cards.map((card) =>
    [
      card.productGroupId,
      card.name,
      card.price,
      card.referencePrice ?? "",
      card.hasPriceRange,
      card.badge ?? "",
    ].join(":"),
  );
  return [kind, data.title, data.caption ?? "", formatStoreDate(data.date), ...cards].join("|");
}

function renderPage(kind: PieceKind, data: PieceData, quality: number): Promise<Blob> {
  const key = pageKey(kind, data);
  const cached = pageCache.get(key);
  if (cached) return cached;

  const pending = renderPiece(kind, data)
    .then((pixels) => pixelsToJpegBlob(pixels, quality))
    .catch((error: unknown) => {
      pageCache.delete(key);
      throw error;
    });

  pageCache.set(key, pending);
  if (pageCache.size > PAGE_CACHE_SIZE) pageCache.delete(pageCache.keys().next().value!);
  return pending;
}

/** Fecha o PDF: uma página por JPEG, e a área de cada card apontando para o produto no site. */
async function assemblePdf(request: PieceRequest, groups: LoadedCard[][], jpegs: Blob[]): Promise<Blob> {
  const spec = PIECE_SPECS[request.format.piece];

  const pages = await Promise.all(
    jpegs.map(async (jpeg, index) => ({
      jpeg: new Uint8Array(await jpeg.arrayBuffer()),
      pixelWidth: spec.width,
      pixelHeight: spec.height,
      links: cardRects(spec, groups[index].length).map((rect, position) => ({
        ...rect,
        url: productLink(groups[index][position].product.productGroupId, request.date),
      })),
    })),
  );

  const bytes = writePdf({ title: request.title, pages, pointsPerPixel: PDF_POINTS_PER_PIXEL });
  return new Blob([bytes], { type: request.format.mimeType });
}

/**
 * Monta a peça: baixa as artes e as fotos, desenha cada página e fecha o
 * arquivo. Tudo no navegador — nada sobe para o servidor.
 *
 * O banner é uma página só, e o arquivo é o próprio JPEG. O catálogo são várias
 * páginas do mesmo molde dentro de um PDF.
 */
export async function buildPiece(request: PieceRequest): Promise<PieceResult> {
  const { format } = request;
  const spec = PIECE_SPECS[format.piece];

  const [header, footer, loaded] = await Promise.all([
    loadAssetAsDataUrl(HEADER_ART[format.piece]),
    loadAssetAsDataUrl(footerArtUrl),
    loadCards(request.candidates, format.minPhotoSide),
  ]);

  const chosen = loaded.slice(0, request.count);
  if (chosen.length === 0) {
    throw new Error(
      format.minPhotoSide > 0
        ? "Nenhum produto sorteado tem foto grande o bastante para o catálogo. Tente de novo ou escolha outro tema."
        : "Nenhuma foto de produto pôde ser carregada. Confira a conexão e tente de novo.",
    );
  }

  const groups = chunk(chosen, spec.maxProducts);
  const jpegs: Blob[] = [];

  // Uma página por vez: o worker é um só, e a ordem é a que a tela anuncia.
  for (const [index, group] of groups.entries()) {
    request.onProgress?.({ page: index + 1, pages: groups.length });

    jpegs.push(
      await renderPage(
        format.piece,
        {
          title: request.title,
          caption: groups.length > 1 ? `Página ${index + 1} de ${groups.length}` : undefined,
          cards: group.map((item) => item.card),
          store: CATALOG_STORE,
          date: request.date,
          art: { header, footer },
        },
        format.jpegQuality,
      ),
    );
  }

  return {
    blob: format.extension === "pdf" ? await assemblePdf(request, groups, jpegs) : jpegs[0],
    pages: jpegs,
    products: chosen.map((item) => item.product),
  };
}

/** Só para os testes: esquece as páginas guardadas. */
export function clearPageCacheForTests(): void {
  pageCache.clear();
}

import feedHeaderUrl from "../assets/feed-header.jpg";
import pageHeaderUrl from "../assets/page-header.jpg";
import footerArtUrl from "../assets/story-footer.jpg";
import storyHeaderUrl from "../assets/story-header.jpg";
import type { PieceKind } from "../template/geometry";

/**
 * As artes da marca (ver `Artes/catalogo/gerador`). O cabeçalho muda com o
 * formato; o rodapé é o mesmo em todas as peças — também no banner de destaque,
 * que usa as do banner do mesmo tamanho.
 */
export const HEADER_ART: Record<PieceKind, string> = {
  story: storyHeaderUrl,
  feed: feedHeaderUrl,
  page: pageHeaderUrl,
};

export const FOOTER_ART = footerArtUrl;

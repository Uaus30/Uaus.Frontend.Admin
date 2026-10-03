import { CATALOG_FORMAT, enumCode, type EnumValue } from "@workspace/api-client-react";
import { FEED, PAGE, PIECE_SPECS, STORY, type PieceKind } from "../template/geometry";
import type { CatalogFormat } from "../types";
import type { CatalogThemeOption } from "./themes";

/** Um formato de peça: o que a tela mostra, o que vai ao sorteio e o arquivo que sai. */
export interface CatalogFormatOption {
  key: CatalogFormat;
  /** Código de `CATALOG_FORMAT`: é como o formato vai ao registro da peça. */
  code: number;
  /** Como o formato aparece no seletor. */
  label: string;
  /** Para onde a peça vai — a linha miúda do seletor. */
  hint: string;
  /** "banner" é imagem e "catálogo" é PDF: o vocabulário do dono, nos botões e avisos. */
  noun: "banner" | "catálogo";
  /** O molde de cada página. */
  piece: PieceKind;
  /** Quantos produtos pedir ao sorteio. */
  count: number;
  /** Reservas, para a foto fora do ar (ou pequena demais) ceder a vaga. */
  spare: number;
  /**
   * Menor lado, em pixels, que a foto precisa ter. Zero aceita qualquer uma.
   *
   * O do PDF é o MESMO número do servidor (`CatalogDrawRules.LargeCardMinPhotoSide`):
   * lá o sorteio já deixa de fora a foto medida como pequena, e aqui a conferência
   * se repete com o arquivo na mão, que é a única medida para a foto que a rotina
   * de fundo ainda não alcançou.
   */
  minPhotoSide: number;
  /** Qualidade do JPEG de cada página. */
  jpegQuality: number;
  extension: "jpg" | "pdf";
  mimeType: string;
}

/**
 * Cinco páginas de seis (escolha do dono, 03/10/2026, depois de ver o de
 * quatro): 30 produtos, dentro da faixa de 24 a 32 combinada para o PDF.
 */
const PDF_PAGES = 5;

export const CATALOG_FORMATS: Record<CatalogFormat, CatalogFormatOption> = {
  story: {
    key: "story",
    code: CATALOG_FORMAT.Story,
    label: "Banner 9:16",
    hint: "status do WhatsApp e story do Instagram",
    noun: "banner",
    piece: "story",
    count: STORY.maxProducts,
    spare: 4,
    minPhotoSide: 0,
    jpegQuality: 0.92,
    extension: "jpg",
    mimeType: "image/jpeg",
  },
  feed: {
    key: "feed",
    code: CATALOG_FORMAT.Feed,
    label: "Banner 4:5",
    hint: "imagem para o grupo e para o feed",
    noun: "banner",
    piece: "feed",
    count: FEED.maxProducts,
    spare: 4,
    minPhotoSide: 0,
    jpegQuality: 0.92,
    extension: "jpg",
    mimeType: "image/jpeg",
  },
  pdf: {
    key: "pdf",
    code: CATALOG_FORMAT.Pdf,
    label: "Catálogo em PDF",
    hint: "grupos de WhatsApp, com link para o site",
    noun: "catálogo",
    piece: "page",
    count: PAGE.maxProducts * PDF_PAGES,
    spare: 8,
    minPhotoSide: 300,
    // Um pouco abaixo do banner: são cinco páginas no mesmo arquivo, e ele
    // sobe para o grupo pelo 4G.
    jpegQuality: 0.86,
    extension: "pdf",
    mimeType: "application/pdf",
  },
};

/** A ordem do seletor: do que o dono usa todo dia para o que usa de vez em quando. */
export const FORMAT_ORDER: readonly CatalogFormat[] = ["story", "feed", "pdf"];

export const DEFAULT_FORMAT: CatalogFormat = "story";

/** "9 produtos", "até 30 produtos" — o tamanho da peça, para o seletor. */
export function describeFormatSize(format: CatalogFormatOption): string {
  const perPage = PIECE_SPECS[format.piece].maxProducts;
  return format.count > perPage ? `até ${format.count} produtos` : `${format.count} produtos`;
}

/** O rótulo do formato que a API devolve (pelo nome). Desconhecido vira "Peça". */
export function formatLabel(format: EnumValue): string {
  const code = enumCode(format, CATALOG_FORMAT);
  return (
    FORMAT_ORDER.map((key) => CATALOG_FORMATS[key]).find((option) => option.code === code)?.label ?? "Peça"
  );
}

/** Quantos cadastros o tema tem para ESTE formato: o PDF só conta os de foto grande. */
export function availableProducts(theme: CatalogThemeOption, format: CatalogFormatOption): number {
  return format.minPhotoSide > 0 ? theme.productsWithLargePhoto : theme.products;
}

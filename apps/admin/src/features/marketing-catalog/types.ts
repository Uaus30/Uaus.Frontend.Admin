/**
 * Selo desenhado sobre a foto do card. No máximo UM por produto: dois selos
 * disputando o canto da foto não informam mais, só tapam o produto.
 */
export type CatalogBadge = "offer" | "new" | "lastUnits";

/**
 * Um produto do catálogo, como ele chega dos dados: o que o cliente pode ver.
 * Custo e saldo não existem aqui de propósito — a peça circula em grupo de
 * WhatsApp, fora do controle da loja.
 */
export interface CatalogProduct {
  /** Id do grupo (o cadastro). É ele que vira o link do produto no site. */
  productGroupId: number;
  name: string;
  /** O que o cliente paga hoje: o promocional quando há oferta vigente. */
  price: number;
  /** As variações têm preços diferentes: o card diz "a partir de". */
  hasPriceRange: boolean;
  /**
   * O "de" da oferta. Ausente sem promoção e também quando o corte é de até 5%
   * — a regra é do servidor, a mesma do site.
   */
  referencePrice?: number;
  /** URL pública da capa, no bucket. */
  imageUrl: string;
  badge?: CatalogBadge;
}

/** O produto pronto para o molde: a foto já baixada, reduzida e em data URL. */
export interface CatalogCard extends Omit<CatalogProduct, "imageUrl"> {
  photo: string;
}

/** Contato da loja impresso no rodapé. Campo vazio não é impresso. */
export interface CatalogStoreInfo {
  address: string;
  whatsapp: string;
  site: string;
}

/** As duas artes do banner, em data URL (ver `Artes/catalogo/gerador`). */
export interface StoryBannerArt {
  header: string;
  footer: string;
}

/** Tudo o que o molde do banner 9:16 precisa para ser desenhado. */
export interface StoryBannerData {
  title: string;
  cards: CatalogCard[];
  store: CatalogStoreInfo;
  /** O dia impresso no aviso de preços. */
  date: Date;
  art: StoryBannerArt;
}

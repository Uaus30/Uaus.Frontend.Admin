/**
 * Selo desenhado sobre a foto do card. No máximo UM por produto: dois selos
 * disputando o canto da foto não informam mais, só tapam o produto.
 */
export type CatalogBadge = "offer" | "new" | "lastUnits";

/**
 * O papel que fez o produto sair no sorteio (o `CATALOG_ROLE` da API, em nome
 * de tela). É ele que a troca de um produto devolve ao servidor: a novidade
 * trocada dá lugar a outra novidade, e a mistura da peça não se desfaz.
 */
export type CatalogRole = "offer" | "new" | "bestSeller" | "regular" | "slow";

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
  role: CatalogRole;
  badge?: CatalogBadge;
  /**
   * O resumo do combo ("3 por R$ 20,00"), quando o produto está num combo
   * vigente (05/10/2026). O preço do card continua o NORMAL — a unidade avulsa
   * sai por ele —, e o resumo vai no selo de promoção, no lugar da palavra.
   */
  comboOffer?: string;
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

/** As duas artes de uma peça, em data URL (ver `Artes/catalogo/gerador`). */
export interface PieceArt {
  header: string;
  footer: string;
}

/** Tudo o que o molde precisa para desenhar uma peça (ou uma página do PDF). */
export interface PieceData {
  title: string;
  /** Linha miúda sob o título — "Página 2 de 4", no catálogo em PDF. */
  caption?: string;
  cards: CatalogCard[];
  store: CatalogStoreInfo;
  /** O dia impresso no aviso de preços. */
  date: Date;
  art: PieceArt;
}

/**
 * O que a pessoa escolhe gerar. "Banner" é imagem e "catálogo" é PDF — é o
 * vocabulário do dono.
 */
export type CatalogFormat = "story" | "feed" | "pdf";

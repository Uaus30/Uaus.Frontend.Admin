/**
 * Cores do molde.
 *
 * O laranja é o da ARTE da marca, medido nela (média da textura: #F85A03), e
 * não o token do admin: o cabeçalho é a arte, e um laranja vizinho ao lado dela
 * aparece como remendo.
 */
export const CATALOG_COLORS = {
  orange: "#F85A03",
  /** Fundo do painel dos produtos: creme quente, para o card branco destacar. */
  panel: "#FFF1E4",
  card: "#FFFFFF",
  /** Texto: quase preto puxado para o marrom, que conversa com o laranja. */
  ink: "#2B1B12",
  muted: "#8A6A57",
  white: "#FFFFFF",
  /**
   * O vermelho do selo de PROMOÇÃO (05/10/2026): o dono pediu uma cor mais
   * chamativa que o preto de antes. Vermelho de cartaz de oferta, com o raio em
   * amarelo — o amarelo da etiqueta de gôndola de Promoção (`#ffe600`), que o
   * cliente já vê na prateleira.
   */
  promo: "#E30613",
  promoAccent: "#FFE600",
} as const;

/** A família embutida no arquivo — a mesma do logotipo. */
export const CATALOG_FONT_FAMILY = "Montserrat";

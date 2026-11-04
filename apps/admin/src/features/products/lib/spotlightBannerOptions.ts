import type { ProductTableRow, SpotlightBannerKind } from "../types";

export interface SpotlightBannerOption {
  kind: SpotlightBannerKind;
  label: string;
}

/**
 * Os banners de destaque que o menu da linha oferece (pedido do dono,
 * 04/11/2026), sempre nesta ordem:
 *
 * - **"Banner de novidade"**: sempre, por padrão — também para produto antigo
 *   (decisão do dono). A janela avisa quando ele passa da janela de novidade.
 * - **"Banner promocional"**: só com promoção ativa — o preço que a linha mostra
 *   já vem com ela (`shelf`, desde 05/10/2026), relâmpago, Dia a Dia ou combo.
 * - **"Banner de reposição"**: só quando o servidor marca a linha (compra nos
 *   últimos 7 dias, sem ser novidade).
 *
 * A janela confere tudo de novo no servidor: a promoção pode ter acabado entre a
 * listagem e o toque.
 */
export function spotlightBannerOptions(product: ProductTableRow): SpotlightBannerOption[] {
  const options: SpotlightBannerOption[] = [{ kind: "new", label: "Banner de novidade" }];

  if (product.shelf && product.shelf.kind !== "regular") {
    options.push({ kind: "offer", label: "Banner promocional" });
  }
  if (product.isRecentRestock) {
    options.push({ kind: "restock", label: "Banner de reposição" });
  }

  return options;
}

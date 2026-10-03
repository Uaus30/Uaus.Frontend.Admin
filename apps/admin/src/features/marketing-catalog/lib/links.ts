import { storeDateKey } from "../template/text";
import { CATALOG_STORE } from "./storeContact";

/**
 * O endereço do produto no site, marcado com a origem.
 *
 * As três marcas são lidas pelo coletor de métricas do site
 * (`apps/loja/src/lib/metrics/collector.ts`): é por elas que a tela de métricas
 * separa quem chegou pelo catálogo de quem chegou pela busca. A campanha leva o
 * dia da peça — cada catálogo compartilhado vira uma linha própria.
 */
export function productLink(productGroupId: number, date: Date): string {
  const params = new URLSearchParams({
    utm_source: "whatsapp",
    utm_medium: "catalogo",
    utm_campaign: `catalogo-${storeDateKey(date)}`,
  });

  return `https://${CATALOG_STORE.site}/produtos/${productGroupId}?${params.toString()}`;
}

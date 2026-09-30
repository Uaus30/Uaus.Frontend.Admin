/**
 * Da URL do navegador para o que o coletor grava.
 *
 * A rota vai NORMALIZADA (`/produtos/:id`, e não `/produtos/905`) e o id em
 * campo próprio: sem isso cada produto viraria uma "página" no ranking de
 * páginas mais vistas, e o ranking de produtos teria que interpretar texto.
 */
export interface MetricsRoute {
  path: string;
  productGroupId?: number;
}

const PRODUCT_DETAIL = /^\/produtos\/(\d+)\/?$/;

export function toMetricsRoute(pathname: string): MetricsRoute {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname || "/";

  const detail = PRODUCT_DETAIL.exec(clean);
  if (detail) {
    const id = Number(detail[1]);
    return Number.isSafeInteger(id) && id > 0
      ? { path: "/produtos/:id", productGroupId: id }
      : { path: clean };
  }

  return { path: clean.startsWith("/") ? clean : `/${clean}` };
}

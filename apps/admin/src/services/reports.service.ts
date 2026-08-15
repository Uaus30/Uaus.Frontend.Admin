import { apiGetOrThrow } from "@workspace/api-client-react";
import type { CategoryReport, TagReport } from "./mappers";

/**
 * Relatórios de desempenho de recortes do catálogo.
 *
 * O intervalo é opcional: sem datas o backend usa os últimos 30 dias, que é o
 * recorte com que as telas de categoria e etiqueta abrem.
 */

/** Desempenho dos produtos de uma categoria no intervalo. */
export async function getCategoryReport(
  categoryId: number,
  params?: { startDate?: string; endDate?: string },
) {
  return apiGetOrThrow<CategoryReport>(`/Categories/${categoryId}/report`, {
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}

/** Desempenho dos produtos marcados com uma etiqueta no intervalo. */
export async function getTagReport(tagId: number, params?: { startDate?: string; endDate?: string }) {
  return apiGetOrThrow<TagReport>(`/Tags/${tagId}/report`, {
    startDate: params?.startDate,
    endDate: params?.endDate,
  });
}

import type { InventoryCountItemDto } from "@workspace/api-client-react";
import type { PhotoCoverage } from "../types";

/**
 * O cadastro tem foto?
 *
 * São DOIS estados desde 12/09/2026. Eram três — "duas de cinco variações sem
 * foto" era atenção (âmbar) — enquanto a galeria pertencia ao SKU e um grupo
 * podia estar pela metade. Com a foto no GRUPO não existe meio-termo: ou o
 * cadastro tem galeria, ou não tem. O vocabulário de cor é o de
 * `Uaus.Docs/dominio/convencoes-de-interface.md`.
 */
export function photoCoverage(item: InventoryCountItemDto): PhotoCoverage {
  return item.hasImage ? "complete" : "missing";
}

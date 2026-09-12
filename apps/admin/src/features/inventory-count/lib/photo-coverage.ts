import type { InventoryCountItemDto } from "@workspace/api-client-react";
import type { PhotoCoverage } from "../types";

/**
 * Quanto da foto do cadastro está faltando.
 *
 * São três estados e não dois porque um grupo com variações pode estar pela
 * metade: "duas de cinco sem foto" é atenção (âmbar), "nenhuma variação com
 * foto" é defeito (vermelho), e o resto não precisa de aviso nenhum. O
 * vocabulário é o de `Uaus.Docs/dominio/convencoes-de-interface.md`.
 *
 * Cadastro **sem variação viva** conta como `missing`: não há foto porque não há
 * produto, e é exatamente o tipo de cadastro que a conferência existe para
 * achar.
 */
export function photoCoverage(item: InventoryCountItemDto): PhotoCoverage {
  if (item.variationsWithoutImage === 0 && item.variationsCount > 0) return "complete";
  if (item.variationsWithoutImage >= item.variationsCount) return "missing";
  return "partial";
}

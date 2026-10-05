import type { CatalogProduct, CatalogRole } from "../types";

/** Os produtos que saem da peça e que têm o mesmo papel: viram UM pedido ao servidor. */
export interface RoleSwap {
  role: CatalogRole;
  /** Na ordem em que estão na peça. */
  leaving: CatalogProduct[];
}

/**
 * Junta pelo papel os produtos marcados para trocar, na ordem em que aparecem
 * na peça. Cada grupo é um sorteio de `leaving.length` produtos daquele papel —
 * é o que mantém a mistura: as duas novidades trocadas dão lugar a outras duas
 * novidades.
 *
 * Id marcado que não está na peça é ignorado; repetido conta uma vez só.
 */
export function groupSwapsByRole(
  products: readonly CatalogProduct[],
  selectedIds: readonly number[],
): RoleSwap[] {
  const selected = new Set(selectedIds);
  const groups = new Map<CatalogRole, CatalogProduct[]>();

  for (const product of products) {
    if (!selected.has(product.productGroupId)) continue;
    const group = groups.get(product.role);
    if (group) group.push(product);
    else groups.set(product.role, [product]);
  }

  return [...groups].map(([role, leaving]) => ({ role, leaving }));
}

/**
 * Casa cada produto que sai com um substituto do sorteio do papel dele, na
 * ordem: o primeiro sorteado entra no lugar do primeiro marcado.
 *
 * O servidor pode devolver MENOS do que foi pedido (o tema acabou), e aí os
 * últimos marcados daquele papel ficam onde estão. Substituto repetido — ou que
 * já está na peça — é descartado: quando falta produto do papel, o servidor
 * completa com outros papéis, e dois sorteios podem trazer o mesmo cadastro.
 *
 * Devolve o substituto pelo id de quem sai.
 */
export function matchReplacements(
  swaps: readonly RoleSwap[],
  drawn: readonly (readonly CatalogProduct[])[],
  inPiece: readonly number[],
): Map<number, CatalogProduct> {
  const taken = new Set(inPiece);
  const replacements = new Map<number, CatalogProduct>();

  swaps.forEach((swap, index) => {
    const candidates = (drawn[index] ?? []).filter((product) => !taken.has(product.productGroupId));

    for (const leaving of swap.leaving) {
      const replacement = candidates.shift();
      if (!replacement) break;
      taken.add(replacement.productGroupId);
      replacements.set(leaving.productGroupId, replacement);
    }
  });

  return replacements;
}

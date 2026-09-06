import type { SupplierDto } from "@workspace/api-client-react";

/**
 * Ordenação dos itens que aparecem em SELECT no Admin.
 *
 * A regra do dono (05/09/2026): todo select mostra os itens em ordem
 * alfabética, com UMA exceção — o de fornecedor, que começa pela Shopee.
 * Sem isso as listas saíam na ordem de cadastro (id), e procurar um
 * fornecedor ou um departamento no meio de dezenas virava varredura visual.
 *
 * A ordenação mora na FONTE de cada lista (os catálogos de `use-catalog` e o
 * `getEnumOptions` de `services/core`), não em cada tela: são trinta e seis
 * arquivos com select no admin, e ordenar em cada um garante que o próximo
 * esqueça.
 *
 * Não vale para sequência com ordem própria — período ("Últimos 7 dias"),
 * itens por página, parcelas, situação que descreve um fluxo (Pendente → A
 * caminho → Lançado). Alfabetar essas listas embaralha o significado.
 */

/**
 * Comparador de nomes em português.
 *
 * `sensitivity: "base"` ignora acento e caixa: "Água" fica junto de "agua", e
 * não depois de "Zeta" como aconteceria com o comparador ordinal. `numeric`
 * ordena "Máximo 20" antes de "Máximo 50" — sem ele, "Máximo 100" viria antes
 * de "Máximo 20", porque "1" precede "2" caractere a caractere.
 */
const nameCollator = new Intl.Collator("pt-BR", { sensitivity: "base", numeric: true });

/** Compara dois nomes pela regra acima. */
export function compareNames(left: string, right: string): number {
  return nameCollator.compare(left, right);
}

/**
 * Cópia da lista em ordem alfabética.
 *
 * Cópia, e não `sort` no lugar: a lista vem do cache do React Query, e ordenar
 * o array original mutaria o que outras telas já leram.
 */
export function orderByName<T>(items: readonly T[], getName: (item: T) => string): T[] {
  return [...items].sort((left, right) => compareNames(getName(left), getName(right)));
}

/**
 * `select` pronto para catálogos cujo item tem `name` — o formato de quase
 * todos. Declarado no módulo (e não inline no hook) porque o React Query
 * refaz o `select` quando a função muda de identidade: inline, a lista seria
 * recriada a cada render.
 */
export function orderCatalogByName<T extends { name: string }>(items: T[]): T[] {
  return orderByName(items, (item) => item.name);
}

/** Como o fornecedor que abre a lista se chama. Comparado sem caixa nem acento. */
const PRIMEIRO_FORNECEDOR = "shopee";

/**
 * Fornecedores com a **Shopee primeiro** e os demais em ordem alfabética.
 *
 * O critério é o NOME, não o id: o id da Shopee é 13 em dev e não há garantia
 * de ser o mesmo em produção — a versão anterior fixava o id 6, que em dev é
 * "Max Atacadista", e a lista abria no fornecedor errado.
 */
export function orderSupplierOptions(suppliers: SupplierDto[]): SupplierDto[] {
  const ehPrimeiro = (supplier: SupplierDto) =>
    compareNames(supplier.name?.trim() ?? "", PRIMEIRO_FORNECEDOR) === 0;

  return [...suppliers].sort((left, right) => {
    const esquerdaPrimeiro = ehPrimeiro(left);
    const direitaPrimeiro = ehPrimeiro(right);
    if (esquerdaPrimeiro !== direitaPrimeiro) return esquerdaPrimeiro ? -1 : 1;
    return compareNames(left.name, right.name);
  });
}

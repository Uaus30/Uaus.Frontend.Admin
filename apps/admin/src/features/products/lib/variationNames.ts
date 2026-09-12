import type { VariationDraft, VariationValue } from "../types";

/** "AZUL, G" — o miolo do colchete do nome composto. */
export function rotuloDaCombinacao(values: VariationValue[]): string {
  return values
    .map((value) => value.value.trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * O nome que a variação mostra na tela.
 *
 * Espelha o `ProductDisplayName.Compose` do backend de propósito: enquanto o
 * cadastro não foi salvo não existe resposta do servidor para exibir, e a
 * tabela de variações precisa mostrar hoje o nome que a venda vai mostrar
 * amanhã. Divergir daqui é divergir do cupom.
 */
export function nomeExibidoDaVariacao(nomeDoGrupo: string, values: VariationValue[]): string {
  const rotulo = rotuloDaCombinacao(values);
  if (!rotulo) return nomeDoGrupo;

  return `${nomeDoGrupo} [${rotulo}]`.toUpperCase();
}

/** Uma variação gravada, do jeito que o seletor da aba Estoque a mostra. */
export type OpcaoDeVariacao = {
  id: number;
  /** Só a configuração — "G, SLIP" —, sem o nome do produto. */
  label: string;
};

/**
 * As variações GRAVADAS do grupo, da mais ANTIGA para a mais nova.
 *
 * Três decisões, todas pedidas pelo dono em 12/09/2026, e todas com motivo:
 *
 * - **Só as gravadas.** Estoque é do produto; linha sem id ainda não existe no
 *   banco e não tem lote para listar.
 * - **Por id crescente**, e não em ordem alfabética. É a mesma ordem da tabela
 *   de variações da aba Dados, e duas ordens para a mesma lista obrigam a
 *   procurar na segunda tela o que se acabou de ver na primeira. De quebra, a
 *   primeira opção passa a ser a variação mais antiga — a que já existia antes
 *   de o produto ganhar grade e, portanto, a que carrega o estoque e o
 *   histórico dele.
 * - **Rótulo só com a configuração.** O nome do produto está no título da tela;
 *   repetido em cada opção, ele empurrava para fora do seletor justamente o que
 *   distingue uma variação da outra ("CUECA INFANTIL CORES [G, SLIP...").
 *
 * Variação sem valor de grade nenhum (cadastro antigo) cai no nome do grupo —
 * opção em branco não dá para escolher.
 */
export function opcoesDeVariacao(drafts: VariationDraft[], nomeDoGrupo: string): OpcaoDeVariacao[] {
  return drafts
    .filter((draft): draft is VariationDraft & { id: number } => draft.id != null && draft.id > 0)
    .sort((a, b) => a.id - b.id)
    .map((draft) => ({
      id: draft.id,
      label: rotuloDaCombinacao(draft.values) || nomeDoGrupo,
    }));
}

/** Chave de comparação de uma combinação, para achar repetidas. */
export function chaveDaCombinacao(values: VariationValue[]): string {
  return [...values]
    .sort((a, b) => a.gradeType - b.gradeType)
    .map((value) => `${value.gradeType}:${value.value.trim().toUpperCase()}`)
    .join("|");
}

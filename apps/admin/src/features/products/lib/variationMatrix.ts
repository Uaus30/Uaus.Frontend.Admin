import type { GradeTypeCode } from "@workspace/api-client-react";
import { ordenarGrades } from "./variationGrades";
import type { ProductGrade, VariationDraft, VariationValue } from "../types";

/**
 * Cruza os valores das grades escolhidas, uma combinação por variação.
 *
 * Duas grades com 3 e 2 valores geram 6 variações. Uma grade só com 4 valores
 * gera 4. Nenhuma grade escolhida gera lista vazia — e é por isso que a modal
 * exige pelo menos uma.
 */
export function gerarCombinacoes(grades: ProductGrade[]): VariationValue[][] {
  const ordenadas = ordenarGrades(grades);
  if (ordenadas.length === 0) return [];

  return ordenadas.reduce<VariationValue[][]>(
    (combinacoes, grade) =>
      combinacoes.flatMap((combinacao) =>
        grade.values.map((value) => [...combinacao, { gradeType: grade.type, value }]),
      ),
    [[]],
  );
}

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

/** Chave de comparação de uma combinação, para achar repetidas. */
export function chaveDaCombinacao(values: VariationValue[]): string {
  return [...values]
    .sort((a, b) => a.gradeType - b.gradeType)
    .map((value) => `${value.gradeType}:${value.value.trim().toUpperCase()}`)
    .join("|");
}

export type MatrizMesclada = {
  /** Um slot por combinação da matriz nova, com o draft existente quando houver. */
  slots: Array<{ values: VariationValue[]; existente: VariationDraft | null }>;
  /** Drafts que saíram da matriz. Os já salvos precisam ser excluídos no servidor. */
  removidas: VariationDraft[];
};

/** Os valores de uma combinação por grade, normalizados para comparação. */
function valoresPorGrade(values: VariationValue[]): Map<GradeTypeCode, string> {
  const mapa = new Map<GradeTypeCode, string>();

  for (const value of values) {
    const limpo = value.value.trim().toUpperCase();
    if (limpo) mapa.set(value.gradeType, limpo);
  }

  return mapa;
}

/**
 * Quantas grades as duas combinações têm em comum COM O MESMO VALOR — ou
 * `null` quando discordam em alguma grade que ambas possuem.
 *
 * É o que permite reconhecer a mesma variação depois de a matriz ganhar ou
 * perder uma coluna: "[10L]" e "[AZUL, 10L]" concordam em Tamanho e não
 * discordam em nada, então são a mesma variação com uma grade a mais. Já
 * "[10L]" e "[6L]" discordam no Tamanho, e aí são variações diferentes.
 */
function gradesEmComum(umas: VariationValue[], outras: VariationValue[]): number | null {
  const a = valoresPorGrade(umas);
  const b = valoresPorGrade(outras);
  let comuns = 0;

  for (const [type, valor] of a) {
    const doOutro = b.get(type);
    if (doOutro === undefined) continue;
    if (doOutro !== valor) return null;
    comuns += 1;
  }

  return comuns;
}

/**
 * Casa a matriz nova com as variações que o produto já tem.
 *
 * São duas passadas, e a ordem entre elas é o que garante determinismo:
 *
 * 1. **Combinação idêntica** — a variação não mudou de identidade. Ela fica
 *    onde está, com id, preço, código de barras e estoque.
 * 2. **Combinação compatível** — a variação concorda com o slot em todas as
 *    grades que os dois têm. É a passada que faz ACRESCENTAR UMA GRADE não
 *    destruir o cadastro: com "Cor: AZUL" entrando num produto que já tinha
 *    "[10L]", "[6L]" e "[3,6L]", cada linha vira "[AZUL, 10L]", "[AZUL, 6L]" e
 *    "[AZUL, 3,6L]" mantendo o código de barras — em vez de nascerem três
 *    linhas em branco e as três originais virarem órfãs na tela. Vale para o
 *    caminho inverso também: tirar uma grade preserva as variações.
 *
 * Quando a grade nova traz mais de um valor, o casamento é por ordem: as
 * variações atuais ficam com o primeiro valor e as demais combinações nascem
 * em branco. A modal avisa antes de gerar, porque aí a escolha é um palpite.
 *
 * Regerar a matriz descartando tudo era o bug mais caro da tela: os drafts
 * novos nasciam sem `id`, o salvar criava produtos NOVOS e as variações antigas
 * ficavam no banco — o grupo acumulava duplicatas e a checagem de combinação
 * repetida passava a bloquear qualquer salvamento.
 */
export function mesclarMatriz(atuais: VariationDraft[], combinacoes: VariationValue[][]): MatrizMesclada {
  const slots: MatrizMesclada["slots"] = combinacoes.map((values) => ({ values, existente: null }));
  // Ordem de inserção preservada: é ela que faz a duplicata pré-existente
  // (o bug que esta função corrige) resolver na PRIMEIRA, que é a mais antiga.
  const livres = new Set(atuais);

  for (const slot of slots) {
    const chave = chaveDaCombinacao(slot.values);
    const identica = [...livres].find((draft) => chaveDaCombinacao(draft.values) === chave);
    if (!identica) continue;
    slot.existente = identica;
    livres.delete(identica);
  }

  for (const slot of slots) {
    if (slot.existente) continue;

    let melhor: VariationDraft | null = null;
    let melhorComuns = 0;

    for (const draft of livres) {
      const comuns = gradesEmComum(draft.values, slot.values);
      // `0` é o draft sem nenhuma grade em comum — o caso da grade trocada de
      // tipo ("Modelo: AZUL" virando "Cor"). Aproveitá-lo aqui casaria
      // qualquer variação com qualquer slot; quem troca o tipo é a coluna da
      // tabela, que renomeia a grade sem mexer na matriz.
      if (comuns === null || comuns === 0) continue;
      // Mais grades em comum = casamento mais específico. Empate fica com o
      // primeiro, que é o mais antigo.
      if (comuns > melhorComuns) {
        melhor = draft;
        melhorComuns = comuns;
      }
    }

    if (!melhor) continue;
    slot.existente = melhor;
    livres.delete(melhor);
  }

  return { slots, removidas: atuais.filter((draft) => livres.has(draft)) };
}

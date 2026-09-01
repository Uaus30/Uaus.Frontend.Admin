import type { GradeTypeCode } from "@workspace/api-client-react";
import type { ProductGrade, VariationDraft, VariationValue } from "../types";

/**
 * Ordem em que as grades aparecem no nome composto.
 *
 * Fixa de propósito: sem ela, o mesmo produto sairia "[AZUL, G]" se o operador
 * marcasse Cor antes de Tamanho e "[G, AZUL]" se marcasse na ordem inversa — e
 * o nome mudaria por causa da ordem dos cliques, não do produto.
 */
const ORDEM_DAS_GRADES: GradeTypeCode[] = [2, 1, 3];

/** As grades escolhidas, sempre na mesma ordem, e só as que têm valor. */
export function ordenarGrades(grades: ProductGrade[]): ProductGrade[] {
  return [...grades]
    .map((grade) => ({ ...grade, values: grade.values.map((v) => v.trim()).filter(Boolean) }))
    .filter((grade) => grade.values.length > 0)
    .sort((a, b) => ORDEM_DAS_GRADES.indexOf(a.type) - ORDEM_DAS_GRADES.indexOf(b.type));
}

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

/**
 * As grades de um conjunto de variações já gravadas.
 *
 * Serve para a modal reabrir marcada do jeito que o produto está: as grades são
 * as que aparecem nas variações, e os valores de cada uma são os distintos
 * encontrados. Sem isto, reabrir a configuração de um produto salvo mostraria
 * tudo em branco e regerar a matriz apagaria as variações.
 */
export function gradesDasVariacoes(drafts: VariationDraft[]): ProductGrade[] {
  const porGrade = new Map<GradeTypeCode, string[]>();

  for (const draft of drafts) {
    for (const value of draft.values ?? []) {
      const atuais = porGrade.get(value.gradeType) ?? [];
      const limpo = value.value.trim();
      if (limpo && !atuais.some((v) => v.toUpperCase() === limpo.toUpperCase())) {
        atuais.push(limpo);
      }
      porGrade.set(value.gradeType, atuais);
    }
  }

  return ordenarGrades([...porGrade.entries()].map(([type, values]) => ({ type, values })));
}

/**
 * Os valores digitados para uma grade, UM POR LINHA.
 *
 * A separação era por vírgula até 01/09/2026, e a vírgula é o separador decimal
 * do português: "10L, 6L, 3,6L" virava quatro valores — "10L", "6L", "3" e
 * "6L" —, o repetido caía fora e a variação "[3,6L]", que tinha código de
 * barras e venda, deixava de existir na matriz. Quebra de linha não aparece
 * dentro de valor nenhum, então o vaivém entre a modal e a tabela é fiel.
 *
 * Repetido some (comparando sem caixa) porque duas linhas iguais gerariam duas
 * variações com o mesmo nome — que o salvamento recusa.
 */
export function separarValoresDeGrade(texto: string): string[] {
  const vistos = new Set<string>();
  const valores: string[] = [];

  for (const bruto of texto.split("\n")) {
    const valor = bruto.trim();
    if (!valor) continue;
    const chave = valor.toUpperCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    valores.push(valor);
  }

  return valores;
}

/** O texto que a modal mostra para uma grade já configurada. */
export function juntarValoresDeGrade(values: string[]): string {
  return values.join("\n");
}

/**
 * Troca o TIPO de uma grade em todas as variações, sem mexer nos valores.
 *
 * Existe por causa da importação do sistema anterior: muito produto veio com a
 * grade "Modelo" onde o valor é cor ou tamanho, e a correção pela modal de
 * configuração não serve — desmarcar "Modelo" e marcar "Cor" gera combinações
 * que não têm grade nenhuma em comum com as atuais, então a matriz nasceria em
 * branco e as variações com código de barras iriam para a exclusão. Aqui a
 * variação continua sendo a mesma; só o nome da coluna muda.
 *
 * Se o tipo de destino já estiver em uso em alguma variação, a troca é
 * recusada: duas grades do mesmo tipo na mesma variação não têm representação
 * — nem aqui, nem no `ProductVariationValues` do banco, que tem uma linha por
 * grade. A tabela já não oferece a opção; esta guarda é para o caso de o
 * chamador errar.
 */
export function trocarTipoDeGrade(
  drafts: VariationDraft[],
  de: GradeTypeCode,
  para: GradeTypeCode,
): VariationDraft[] {
  if (de === para) return drafts;

  const emUso = drafts.some((draft) => (draft.values ?? []).some((value) => value.gradeType === para));
  if (emUso) return drafts;

  return drafts.map((draft) => ({
    ...draft,
    values: (draft.values ?? []).map((value) =>
      value.gradeType === de ? { ...value, gradeType: para } : value,
    ),
  }));
}

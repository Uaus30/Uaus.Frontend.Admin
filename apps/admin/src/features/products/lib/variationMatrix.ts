import { GRADE_TYPE_LABELS, type GradeTypeCode } from "@workspace/api-client-react";
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

/**
 * Casa a matriz nova com as variações que o produto já tem, pela combinação.
 *
 * Regerar a matriz descartando tudo era o bug mais caro da tela: os drafts novos
 * nasciam sem `id`, o salvar criava produtos NOVOS e as variações antigas
 * ficavam no banco — o grupo acumulava duplicatas e a checagem de combinação
 * repetida passava a bloquear qualquer salvamento. Preservando o draft cuja
 * combinação continua na matriz, preço, código de barras e id sobrevivem; só o
 * que realmente saiu vai para `removidas`.
 */
export function mesclarMatriz(atuais: VariationDraft[], combinacoes: VariationValue[][]): MatrizMesclada {
  const porChave = new Map<string, VariationDraft>();
  for (const draft of atuais) {
    const chave = chaveDaCombinacao(draft.values);
    // Duplicata pré-existente (o bug que esta função corrige): fica a PRIMEIRA,
    // que é a mais antiga — a segunda cai em `removidas` e sai do cadastro.
    if (!porChave.has(chave)) porChave.set(chave, draft);
  }

  const usadas = new Set<string>();
  const slots = combinacoes.map((values) => {
    const chave = chaveDaCombinacao(values);
    const existente = !usadas.has(chave) ? (porChave.get(chave) ?? null) : null;
    if (existente) usadas.add(chave);
    return { values, existente };
  });

  const removidas = atuais.filter((draft) => {
    const chave = chaveDaCombinacao(draft.values);
    return !usadas.has(chave) || porChave.get(chave) !== draft;
  });

  return { slots, removidas };
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

/** Rótulo da grade, para a tela não repetir o mapa. */
export function rotuloDaGrade(type: GradeTypeCode): string {
  return GRADE_TYPE_LABELS[type] ?? "Grade";
}

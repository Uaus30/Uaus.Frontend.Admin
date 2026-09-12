import type { GradeTypeCode } from "@workspace/api-client-react";
import type { ProductGrade, VariationDraft } from "../types";

/**
 * Ordem em que as grades aparecem no nome composto.
 *
 * Fixa de propósito: sem ela, o mesmo produto sairia "[AZUL, G]" se o operador
 * marcasse Cor antes de Tamanho e "[G, AZUL]" se marcasse na ordem inversa — e
 * o nome mudaria por causa da ordem dos cliques, não do produto.
 */
const ORDEM_DAS_GRADES: GradeTypeCode[] = [2, 1, 3];

/**
 * As grades de um conjunto de variações já gravadas.
 *
 * Serve para a modal reabrir marcada do jeito que o produto está e para a
 * tabela saber quais colunas desenhar: as grades são as que aparecem nas
 * variações, e os valores de cada uma são os distintos encontrados. Sem isto,
 * reabrir a configuração de um produto salvo mostraria tudo em branco e regerar
 * a matriz apagaria as variações.
 *
 * Grade SEM valor nenhum continua na lista — é a coluna em branco que a modal
 * acrescenta, para o operador preencher linha a linha. Filtrá-la aqui faria a
 * coluna sumir no mesmo render em que apareceu, e a validação do salvamento
 * deixaria de cobrar o preenchimento dela.
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

  return [...porGrade.entries()]
    .map(([type, values]) => ({ type, values }))
    .sort((a, b) => ORDEM_DAS_GRADES.indexOf(a.type) - ORDEM_DAS_GRADES.indexOf(b.type));
}

/**
 * Deixa nas variações exatamente as grades escolhidas, sem criar nem apagar
 * linha nenhuma.
 *
 * É o que a modal faz: marcar "Cor" acrescenta a coluna em branco em todas as
 * variações que existem, e o operador digita o valor de cada uma na própria
 * tabela. Desmarcar apaga a coluna e os valores dela.
 *
 * O valor em branco é gravado na variação de propósito, e não guardado num
 * estado à parte: é ele que faz a coluna existir para a tabela e para a
 * validação do salvamento (`gradesDasVariacoes` mantém grade sem valor). Como
 * mora no próprio draft, some junto com ele ao trocar de produto — um estado
 * paralelo precisaria ser limpo à mão em cada caminho que fecha a tela.
 *
 * Não gerar combinação é o ponto: cruzar as grades num produto que já tem
 * venda obriga a chutar qual variação fica com qual valor novo, e o cartesiano
 * também não poupa digitação — as linhas nascem sem preço e sem código de
 * barras de qualquer jeito.
 */
export function aplicarGradesNasLinhas(drafts: VariationDraft[], tipos: GradeTypeCode[]): VariationDraft[] {
  const escolhidos = [...new Set(tipos)].sort(
    (a, b) => ORDEM_DAS_GRADES.indexOf(a) - ORDEM_DAS_GRADES.indexOf(b),
  );

  return drafts.map((draft) => ({
    ...draft,
    values: escolhidos.map((gradeType) => ({
      gradeType,
      value: (draft.values ?? []).find((value) => value.gradeType === gradeType)?.value ?? "",
    })),
  }));
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

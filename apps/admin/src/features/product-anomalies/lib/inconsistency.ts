import { formatCurrency, formatQuantity } from "@workspace/core";
import {
  enumCode,
  GRADE_TYPE,
  GRADE_TYPE_LABELS,
  type GradeTypeCode,
  type ProductAnomalyDto,
} from "@workspace/api-client-react";

/**
 * O nome da grade de uma inconsistência. O enum chega pelo NOME ("Brand"), e
 * tipo desconhecido (backend mais novo que a tela) vira "grade" — uma etiqueta
 * não pode derrubar a lista.
 */
function nomeDaGrade(gradeType: string | null | undefined): string {
  if (!gradeType) return "grade";
  const codigo = enumCode(gradeType, GRADE_TYPE) as GradeTypeCode;
  return GRADE_TYPE_LABELS[codigo] ?? "grade";
}

/**
 * A frase da etiqueta "Inconsistência" (14/10/2026): qual das oito regras de
 * cadastro acusou, com o dado que a acendeu e o que fazer. Sem o motivo, a
 * etiqueta seria um "tem algo errado" que obriga a abrir o produto para
 * descobrir o quê.
 */
export function describeInconsistency(anomaly: ProductAnomalyDto): string {
  const grade = nomeDaGrade(anomaly.gradeType);
  const valor = anomaly.gradeValue ? ` “${anomaly.gradeValue}”` : "";

  switch (anomaly.inconsistency) {
    case "GenericGradeValue":
      return `Valor genérico${valor} na grade ${grade} — troque pelo que distingue a variação (a marca da embalagem, a cor, o sabor).`;
    case "MissingGradeValue":
      return `Sem valor na grade ${grade}, que as outras variações usam — preencha na tabela de variações.`;
    case "SingleVariationGroup":
      return "Produto com variações e um cadastro só: o editor exige duas e não salva. Acrescente a outra variação ou peça a conversão para produto simples.";
    case "StockDiffersFromLots":
      return (
        `Estoque ${formatQuantity(anomaly.stock ?? 0)} no cadastro e ${formatQuantity(anomaly.lotsStock ?? 0)} nos lotes — ` +
        "o caixa vende pelos lotes. Corrija com “Corrigir estoque”."
      );
    case "DuplicateCombination":
      return `Outra variação tem a mesma combinação${valor} — mude o valor de uma delas.`;
    case "SimpleWithGrade":
      return `Produto simples com valor de grade gravado (${grade}${valor}) — o nome sai com um colchete que a tela não mostra.`;
    case "InvalidBarcode":
      return `Código de barras “${anomaly.barcode ?? ""}” fora do padrão EAN-13 (13 dígitos com o verificador).`;
    case "ZeroPrice":
      return `Preço ${formatCurrency(anomaly.price ?? 0)} em produto à venda.`;
    default:
      return "Cadastro com dado inconsistente — abra o produto para conferir.";
  }
}

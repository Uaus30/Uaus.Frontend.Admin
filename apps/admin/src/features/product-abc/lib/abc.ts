import type { AbcClass, SalesFrequency } from "@workspace/api-client-react";

/**
 * A cor de cada classe.
 *
 * É uma escala ORDINAL — A, B e C têm ordem —, então os três passos saem de uma
 * matiz só, do mais escuro ao mais claro. Usar três matizes diferentes gastaria
 * o canal de identidade para re-codificar uma ordem que o próprio rótulo já dá.
 */
export const CLASS_COLORS: Record<string, string> = {
  A: "hsl(25 92% 48%)",
  B: "hsl(25 80% 62%)",
  C: "hsl(25 45% 74%)",
  None: "hsl(215 20% 45%)",
};

/** O que cada classe significa em uma linha, para a legenda e o cabeçalho. */
export const CLASS_MEANING: Record<string, string> = {
  A: "os primeiros 80% do acumulado",
  B: "de 80% a 95%",
  C: "os últimos 5% — a cauda",
  None: "sem classificação",
};

export const FREQUENCY_LABELS: Record<SalesFrequency, string> = {
  Constant: "Constante",
  Occasional: "Ocasional",
  Rare: "Raro",
  None: "—",
};

/** Explicação curta de cada frequência, para o título do elemento. */
export const FREQUENCY_HINTS: Record<SalesFrequency, string> = {
  Constant: "Vendeu em 60% ou mais das semanas do período",
  Occasional: "Vendeu entre 20% e 60% das semanas",
  Rare: "Vendeu em menos de 20% das semanas",
  None: "Sem venda no período",
};

/**
 * O que o cruzamento faturamento × lucro está dizendo.
 *
 * A diagonal é coerência: o item pesa o mesmo nas duas leituras. Fora dela, as
 * duas classificações discordam — e é aí que a curva de faturamento sozinha
 * engana. Acima da diagonal, o produto fatura mais do que lucra; abaixo, lucra
 * mais do que aparece.
 */
export function matrixCellMeaning(revenueClass: AbcClass, profitClass: AbcClass): string {
  if (revenueClass === "A" && profitClass === "A") return "Motor da loja";
  if (revenueClass === "C" && profitClass === "C") return "Cauda";
  if (ordem(revenueClass) < ordem(profitClass)) return "Fatura mais do que lucra";
  if (ordem(revenueClass) > ordem(profitClass)) return "Lucra mais do que aparece";
  return "Coerente";
}

/** Peso da classe para comparar as duas leituras. A = 1, C = 3. */
function ordem(classe: AbcClass): number {
  return classe === "A" ? 1 : classe === "B" ? 2 : 3;
}

/**
 * Como a concentração desta loja se compara à regra de Pareto.
 *
 * A regra prevê que 20% dos produtos façam 80% do valor. O número medido quase
 * nunca é 20 — e a distância entre os dois é a informação, não um defeito da
 * medição.
 */
export function readConcentration(shareOfProductsForEighty: number): {
  titulo: string;
  frase: string;
  tom: "concentrada" | "pareto" | "distribuida";
} {
  const arredondado = Math.round(shareOfProductsForEighty);

  if (arredondado <= 15) {
    return {
      titulo: `${arredondado}/80`,
      frase: `Só ${arredondado}% dos produtos fazem 80% do resultado — mais concentrado que os 20% que a regra de Pareto prevê. Poucos itens sustentam a loja, e a falta de um deles se sente no caixa.`,
      tom: "concentrada",
    };
  }

  if (arredondado <= 25) {
    return {
      titulo: `${arredondado}/80`,
      frase: `${arredondado}% dos produtos fazem 80% do resultado — a loja está em cima da regra de Pareto clássica (20/80).`,
      tom: "pareto",
    };
  }

  return {
    titulo: `${arredondado}/80`,
    frase: `${arredondado}% dos produtos fazem 80% do resultado — a cauda é mais longa que os 20% previstos pela regra de Pareto. O resultado vem de muitos itens pequenos, e não de poucos campeões.`,
    tom: "distribuida",
  };
}

/**
 * Leitura do índice de concentração (Gini) em palavras.
 *
 * O índice existe porque "80/20" é a leitura de UM ponto da curva: duas lojas
 * podem cruzar os 80% no mesmo lugar com caudas completamente diferentes.
 */
export function readConcentrationIndex(indice: number): string {
  if (indice >= 0.75) return "muito concentrada";
  if (indice >= 0.55) return "concentrada";
  if (indice >= 0.35) return "equilibrada";
  return "distribuída";
}

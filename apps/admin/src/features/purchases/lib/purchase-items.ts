import type { PurchaseFormItem } from "../types";

/**
 * O rateio do total do pedido entre as variações — a prévia da tela.
 *
 * Quem VALE é o backend (`PurchaseCostSplit`); esta cópia existe para a grade
 * mostrar a fatia enquanto o operador digita, sem uma ida ao servidor por
 * tecla. As duas precisam concordar, e a regra que as une é a mesma do unitário
 * da compra: **a sobra do arredondamento vai no último item**.
 *
 * Sem ela, R$ 100 em três variações viraria 33,33 × 3 = R$ 99,99 e a tela
 * mostraria uma soma que não bate com o total que o próprio operador digitou —
 * dois números contraditórios na mesma tela, e nenhum erro para explicar.
 */
export function splitPurchaseTotal(total: number, quantities: number[]): number[] {
  if (quantities.length === 0) return [];

  const quantidadeTotal = quantities.reduce((soma, quantidade) => soma + quantidade, 0);
  if (quantidadeTotal <= 0) return quantities.map(() => 0);

  const fatias: number[] = [];
  let acumulado = 0;

  for (let i = 0; i < quantities.length - 1; i++) {
    const fatia = Math.round(((total * quantities[i]) / quantidadeTotal) * 100) / 100;
    fatias.push(fatia);
    acumulado += fatia;
  }

  // Centavos para não arrastar o erro de ponto flutuante do acumulado.
  fatias.push(Math.round((total - acumulado) * 100) / 100);
  return fatias;
}

/**
 * A grade com as fatias preenchidas, do jeito que a tela deve exibi-la.
 *
 * Em rateio, as variações COMPRADAS (quantidade > 0) dividem os totais do
 * pedido e as não compradas ficam zeradas — elas não entram na conta nem viram
 * item. Em modo manual nada é recalculado: o que o operador digitou é o que
 * vale, e mexer aqui apagaria o trabalho dele.
 */
export function applyCostSplit(
  items: PurchaseFormItem[],
  grossTotal: number,
  finalTotal: number,
  costSplitManual: boolean,
): PurchaseFormItem[] {
  if (costSplitManual) return items;

  const comprados = items.filter((item) => item.quantity > 0);
  const quantidades = comprados.map((item) => item.quantity);
  const brutos = splitPurchaseTotal(grossTotal, quantidades);
  const finais = splitPurchaseTotal(finalTotal, quantidades);

  let posicao = 0;
  return items.map((item) => {
    if (item.quantity <= 0) return { ...item, grossTotal: 0, finalTotal: 0 };
    const indice = posicao++;
    return { ...item, grossTotal: brutos[indice], finalTotal: finais[indice] };
  });
}

/** A soma de um campo da grade — o que o cabeçalho mostra em modo manual. */
export function sumItems(items: PurchaseFormItem[], campo: "quantity" | "grossTotal" | "finalTotal"): number {
  const total = items.reduce((soma, item) => soma + item[campo], 0);
  return campo === "quantity" ? total : Math.round(total * 100) / 100;
}

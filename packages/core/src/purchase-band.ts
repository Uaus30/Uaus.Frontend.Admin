import { round2 } from "./money";

/**
 * Faixa de compras do mês: verde, amarelo ou vermelho.
 *
 * Responde, na hora de comprar, se o mês aguenta a compra (PLANO-FINANCEIRO.md,
 * seção 2). A conta das duas linhas é do backend (`GET /PurchaseBudget`):
 *
 * ```
 * linha verde    = custo das vendas + saldo inicial + aportes
 * linha vermelha = vendas líquidas + saldo inicial + aportes − custos fixos
 * ```
 *
 * Aqui mora só a comparação do gasto com as linhas, que a tela precisa refazer
 * para uma compra que ainda não foi gravada ("esta compra leva novembro para o
 * amarelo"). É o mesmo par backend/core do `SalePriceLimit` com o
 * `MAX_SALE_PRICE`: o domínio do backend (`PurchaseBudgetRules.Classify`) e esta
 * função têm que dar a mesma faixa para os mesmos números.
 */
export type PurchaseBand = "green" | "yellow" | "red";

/**
 * Em que faixa ficam as compras pagas do mês.
 *
 * **A ordem dos testes é a regra** (decisão 7 do dono): o verde é testado
 * PRIMEIRO e vale sozinho. No começo do mês as vendas ainda não cobrem os custos
 * fixos — a linha vermelha fica negativa —, e sem esta ordem comprar dentro do
 * custo do que foi vendido daria vermelho, que é justamente o que repõe a
 * prateleira.
 *
 * As bordas são inclusivas: gastar exatamente a linha verde é verde, e
 * exatamente a linha vermelha é amarelo. A comparação é em centavos
 * (`round2`) porque os valores chegam de somas em ponto flutuante — sem isso,
 * `0,1 + 0,2` passaria de `0,3` e uma compra no limite exato viraria amarelo.
 *
 * @param spent Compras pagas no mês (K), com a compra simulada se houver.
 * @param greenLimit Linha verde (C + S + A).
 * @param redLimit Linha vermelha (V + S + A − F).
 */
export function purchaseBandFor(spent: number, greenLimit: number, redLimit: number): PurchaseBand {
  const gasto = round2(spent);
  if (gasto <= round2(greenLimit)) return "green";
  if (gasto <= round2(redLimit)) return "yellow";
  return "red";
}

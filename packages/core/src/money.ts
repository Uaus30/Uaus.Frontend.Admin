/**
 * Dinheiro.
 *
 * Este arquivo é a ÚNICA fonte de arredondamento e formatação monetária do
 * repositório. Antes dele havia cinco implementações de `round2` com três
 * algoritmos diferentes, e elas divergiam em centavos: o total exibido no
 * carrinho podia não bater com o total enviado à API nem com o subtotal
 * impresso no cupom. Se for preciso mexer na regra, mexa aqui.
 */

/**
 * Arredonda para duas casas contornando o erro de ponto flutuante do JavaScript.
 *
 * O `Number.EPSILON` existe porque `1.005 * 100` dá `100.49999999999999` em
 * binário, e `Math.round` devolveria 1,00 num valor que o usuário digitou como
 * 1,005. Somar o epsilon antes da multiplicação empurra o número para o lado
 * certo da fronteira sem afetar valores que já estão exatos.
 *
 * @param value Valor em reais.
 * @returns O valor com no máximo duas casas decimais.
 */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Converte um valor digitado no formato pt-BR ("1.234,50") para número.
 *
 * @param value Texto como o operador digitou.
 * @returns O número, ou `NaN` quando o texto não representa um valor.
 */
export function parseAmount(value: string): number {
  return parseFloat(value.replace(/\./g, "").replace(",", "."));
}

/**
 * Converte um valor digitado tratando campo vazio como zero.
 *
 * Usar `parseAmount` direto num campo opcional manda `NaN` para a API quando o
 * usuário não preenche nada — foi o que aconteceu nos diálogos de abertura e
 * fechamento de caixa. Aqui a diferença entre "não informou" e "informou
 * bobagem" é explícita.
 *
 * @param value Texto como o operador digitou.
 * @returns O valor, ou `null` quando o texto é ilegível.
 */
export function parseAmountOrNull(value: string): number | null {
  if (!value.trim()) return 0;

  const parsed = parseAmount(value);
  return Number.isNaN(parsed) ? null : round2(parsed);
}

/**
 * Valor monetário no formato pt-BR — "R$ 1.234,50".
 *
 * @param value Valor em reais.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Quantidade no formato pt-BR.
 *
 * As casas decimais não são fixadas de propósito: produto vendido a peso pode
 * sair fracionado, mas a esmagadora maioria é inteira e não deve virar "1,000".
 *
 * @param value Quantidade.
 */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(value);
}

/**
 * Percentual no formato pt-BR com duas casas fixas — "12,50%".
 *
 * Duas casas de propósito: os percentuais financeiros (margem, distribuição de
 * lucros e rateio dos fechamentos) usam a precisão do backend (numeric(5,2)),
 * e a soma entre os sócios precisa bater 100,00.
 *
 * @param value Percentual já em escala de 0 a 100.
 */
export function formatPercentage(value: number): string {
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted}%`;
}

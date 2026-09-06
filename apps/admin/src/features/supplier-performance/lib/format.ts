/**
 * Formatação local do BI de fornecedores.
 *
 * `formatPercentage` do `@workspace/core` fixa DUAS casas porque os percentuais
 * financeiros precisam somar 100,00 entre os sócios. Aqui a leitura é de
 * relance, numa tela com dezenas de percentuais por linha, e "42,2%" cabe onde
 * "42,22%" não cabe — por isso o helper é próprio em vez de uma mudança no
 * compartilhado, que quebraria a precisão dos fechamentos.
 */

/** Percentual pt-BR com o número de casas pedido. Aceita valores já em 0–100. */
export function formatPercent(value: number | null | undefined, casas = 1): string {
  if (value == null) return "—";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/**
 * Inteiro pt-BR com separador de milhar.
 *
 * Aceita ausência porque a API serializa com `WhenWritingNull`: campo nulo não
 * chega como `null`, ele simplesmente não vem. Um `number` cru aqui explodia em
 * `toLocaleString` na primeira linha sem venda registrada.
 */
export function formatInteger(value: number | null | undefined): string {
  return value == null ? "—" : value.toLocaleString("pt-BR");
}

/** Moeda compacta para eixo e legenda: "R$ 4,1 mil". */
export function formatCompactCurrency(value: number): string {
  if (Math.abs(value) < 1000) {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  return `R$ ${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
}

/**
 * "hoje", "ontem" ou "há N dias".
 *
 * `null` é ausência de registro, não zero: um fornecedor que nunca vendeu não é
 * um fornecedor que vendeu há zero dias.
 */
export function formatDaysAgo(dias: number | null | undefined): string {
  if (dias == null) return "sem registro";
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  return `há ${formatInteger(dias)} dias`;
}

/** Plural pt-BR sem depender de biblioteca: `plural(1, "produto", "produtos")`. */
export function plural(quantidade: number | null | undefined, singular: string, plural_: string): string {
  if (quantidade == null) return "—";
  return `${formatInteger(quantidade)} ${quantidade === 1 ? singular : plural_}`;
}

/** Converte `"2026-09-06T00:00:00"` em `"06/09/2026"` sem passar por `Date` (fuso). */
export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.split("T")[0].split("-");
  return `${day}/${month}/${year}`;
}

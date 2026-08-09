export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Quantidade no formato pt-BR.
 *
 * As casas decimais não são fixadas de propósito: produto vendido a peso pode
 * sair fracionado, mas a esmagadora maioria é inteira e não deve virar "1,000".
 */
export function formatQuantity(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: 3,
  }).format(value);
}

/**
 * Percentual no formato pt-BR com duas casas fixas — "12,50%".
 *
 * Duas casas de propósito: os percentuais financeiros (margem, distribuição de
 * lucros e rateio dos fechamentos) usam a precisão do backend (numeric(5,2)),
 * e a soma entre os sócios precisa bater 100,00.
 */
export function formatPercentage(value: number): string {
  const formatted = new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted}%`;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
}

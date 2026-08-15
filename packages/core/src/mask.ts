/**
 * Máscaras de campos brasileiros.
 *
 * Vieram de `packages/ui` porque estavam na camada errada: telefone brasileiro
 * é regra de domínio, não componente visual — o kit de UI não deveria saber que
 * DDD tem dois dígitos nem que celular tem nove.
 */

/**
 * Reduz o texto digitado aos dígitos que o backend aceita como telefone.
 *
 * Zeros à esquerda saem porque o operador costuma digitar o "0" de discagem
 * antes do DDD, e o backend guarda só DDD + número.
 *
 * @param value Texto como o usuário digitou.
 * @returns Até 11 dígitos, sem máscara.
 */
export function cleanPhone(value: string): string {
  return value
    .replace(/\D/g, "")
    .replace(/^0+/, "")
    .slice(0, 11);
}

/**
 * Aplica a máscara de telefone conforme o usuário digita.
 *
 * A máscara é progressiva de propósito — completar parênteses e hífen antes da
 * hora faria o cursor pular no meio da digitação. Fixo sai como
 * "(11) 3456-7890" e celular como "(11) 91234-5678".
 *
 * @param value Texto como o usuário digitou.
 * @returns O texto mascarado, ou string vazia quando não há dígito nenhum.
 */
export function formatPhone(value: string): string {
  const cleaned = cleanPhone(value);
  if (!cleaned) return "";

  if (cleaned.length <= 2) return `(${cleaned}`;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
  if (cleaned.length <= 10) {
    return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
  }
  return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
}

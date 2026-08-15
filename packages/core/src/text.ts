/** Marcas de acento que a normalização NFD separa das letras. */
const DIACRITICS = /[̀-ͯ]/g;

/**
 * Prepara um texto para busca: sem acento, sem caixa e sem espaço nas pontas.
 *
 * A decomposição NFD separa a letra do acento ("á" vira "a" + "´"), e aí as
 * marcas podem ser removidas por faixa Unicode. É o que faz "Jose" encontrar
 * "José" e "acucar" encontrar "açúcar" na busca do balcão.
 *
 * @param value Texto digitado ou vindo do cadastro.
 */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS, "").trim().toLowerCase();
}

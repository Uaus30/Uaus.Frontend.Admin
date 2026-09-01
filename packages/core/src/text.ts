/** Marcas de acento que a normalização NFD separa das letras. */
const DIACRITICS = /[̀-ͯ]/g;

/** Espaços seguidos, colapsados para um só. */
const ESPACOS_SEGUIDOS = /\s+/g;

/**
 * Prepara um texto para busca: sem acento, sem caixa e sem espaço nas pontas.
 *
 * A decomposição NFD separa a letra do acento ("á" vira "a" + "´"), e aí as
 * marcas podem ser removidas por faixa Unicode. É o que faz "Jose" encontrar
 * "José" e "acucar" encontrar "açúcar" na busca do balcão.
 *
 * O espaço seguido colapsa para um só, como a função `uaus_norm` do banco
 * (`Uaus.Backend.Api/Uaus.Data/Scripts/2026-09-01_busca_produtos_normalizada.sql`).
 * Sem isso, "bacia  plastica" com dois espaços deixaria de casar com o texto
 * gravado — e a relevância, que compara o começo do nome com o termo inteiro,
 * erraria por um espaço que ninguém vê.
 *
 * @param value Texto digitado ou vindo do cadastro.
 */
export function normalizeSearchText(value: string): string {
  return value.normalize("NFD").replace(DIACRITICS, "").replace(ESPACOS_SEGUIDOS, " ").trim().toLowerCase();
}

/**
 * Escapa texto livre interpolado em HTML.
 *
 * Usado na impressão — cupom e etiqueta de gôndola montam HTML por template
 * string com nome de produto e observação vindos do cadastro, que são campos
 * livres. Sem escapar, um nome com `<` quebra o documento; com aspas, quebra
 * atributo.
 *
 * A aspa simples entra na lista de propósito: havia duas implementações no
 * repositório e a do cupom NÃO a escapava, então o mesmo nome de produto saía
 * seguro na etiqueta e inseguro no cupom.
 *
 * @param value Texto vindo do cadastro.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

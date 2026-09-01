import { normalizeSearchText } from "./text";

/**
 * Preparo do termo de busca de produtos.
 *
 * **Espelho de `SearchTerms.Tokenize` do backend**
 * (`Uaus.Backend.Api/Uaus.Domain/Common/Helpers/SearchTerms.cs`), e é isso que
 * faz a busca do balcão devolver o mesmo resultado com e sem internet. Divergir
 * aqui não gera erro: o operador acha o produto com a rede de pé, não acha com
 * ela caída, e conclui que o cadastro sumiu.
 *
 * A regra está descrita em `Uaus.Backend.Api/docs/busca-de-produtos.md`.
 */

/**
 * Palavras que o cadastro escreve de um jeito e quem busca digita de outro.
 *
 * O caso que motivou a lista: "bacia com tampa" contra
 * "BACIA PLASTICA 2L C/ TAMPA" — o "com" está "C/" no cadastro, e exigi-lo
 * derrubaria o resultado inteiro. Preposição e artigo não distinguem produto
 * nenhum num catálogo de varejo; quem distingue são os substantivos ao redor.
 */
const PALAVRAS_VAZIAS = new Set([
  "a",
  "ao",
  "aos",
  "as",
  "com",
  "da",
  "das",
  "de",
  "do",
  "dos",
  "e",
  "em",
  "na",
  "nas",
  "no",
  "nos",
  "o",
  "os",
  "para",
  "por",
  "pra",
  "sem",
  "um",
  "uma",
]);

/**
 * Teto de palavras por busca, igual ao do backend.
 *
 * Cada palavra é uma varredura a mais do catálogo em memória. Oito já são mais
 * do que qualquer nome de produto do cadastro tem.
 */
const MAXIMO_DE_TOKENS = 8;

/** Separadores: tudo que não for letra ou dígito. */
const NAO_ALFANUMERICO = /[^\p{L}\p{N}]+/u;

/**
 * As palavras que o produto precisa conter para casar com o termo.
 *
 * A quebra é por qualquer caractere que não seja letra ou dígito, e não só por
 * espaço: "coca-cola" e "3/8" viram dois tokens cada e continuam achando o
 * cadastro que os escreve junto — quebrar só torna a busca mais permissiva.
 *
 * Termo feito **só** de palavras vazias devolve essas palavras em vez de lista
 * vazia: quem digitou "para" quer procurar "para" (o cabo de para-raios), e
 * devolver vazio aqui viraria "sem termo", que lista o catálogo inteiro.
 *
 * @param term Termo digitado.
 * @returns Tokens normalizados, sem repetição, no máximo {@link MAXIMO_DE_TOKENS}.
 */
export function tokenizeSearchTerms(term: string | null | undefined): string[] {
  const normalizado = normalizeSearchText(term ?? "");
  if (!normalizado) return [];

  const palavras = [...new Set(normalizado.split(NAO_ALFANUMERICO).filter(Boolean))];
  const comSignificado = palavras.filter((palavra) => !PALAVRAS_VAZIAS.has(palavra));

  return (comSignificado.length > 0 ? comSignificado : palavras).slice(0, MAXIMO_DE_TOKENS);
}

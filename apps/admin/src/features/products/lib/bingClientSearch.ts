/**
 * Busca de imagens no Bing executada do navegador do usuário.
 *
 * ## Por que client-side?
 *
 * O Bing bloqueia ou degrada requisições de IPs de datacenter (servidores cloud).
 * Quando a API fazia a raspagem HTML, o Bing redirecionava para o feed rotativo
 * ou servia resultados de outra busca. Do navegador do usuário (IP residencial),
 * a mesma requisição retorna resultados corretos consistentemente.
 *
 * A requisição passa pelo proxy da Vercel (`/bing-images/...`) para evitar CORS.
 * O edge da Vercel usa IPs distribuídos globalmente, menos suscetíveis a bloqueio.
 *
 * ## Parsing
 *
 * O HTML do Bing carrega cada tile de imagem num atributo `m="..."` com JSON
 * contendo `murl` (URL full), `turl` (thumbnail) e `t` (título). O parsing aqui
 * replica a mesma lógica do `BingImageSearchProvider.cs` do backend.
 */

import type { ImageSearchResult } from "@/services/images.service";

// Mesma regex do backend: captura o JSON do atributo m="..." de cada tile
const IMAGE_BLOB_REGEX = /m="([^"]*?murl[^"]*?)"/gi;

/**
 * Palavras irrelevantes para comparação de pertinência entre query e título.
 * Idêntica à lista do backend C# para manter o comportamento consistente.
 */
const STOP_WORDS = new Set([
  "a",
  "o",
  "as",
  "os",
  "e",
  "c",
  "de",
  "da",
  "do",
  "dos",
  "das",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "um",
  "uma",
  "uns",
  "umas",
  "com",
  "sem",
  "por",
  "pra",
  "para",
  "que",
  "aos",
  "sob",
  "sobre",
  "ao",
  "kit",
  "pct",
  "un",
  "und",
  "cx",
]);

/**
 * Remove acentos de uma string usando normalização Unicode NFD.
 */
function removeAccents(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Quebra texto em tokens comparáveis: sem acento, minúsculas, sem stopwords,
 * mínimo 3 caracteres. Réplica exata do `BingImageSearchProvider.Tokenize`.
 */
export function tokenize(text: string): string[] {
  if (!text?.trim()) return [];
  const normalized = removeAccents(text);
  const cleaned = normalized.replace(/[^a-zA-Z0-9]/g, " ").toLowerCase();
  const rawTokens = cleaned.split(/\s+/).filter(Boolean);

  const alphaTokens = rawTokens.filter((t) => !STOP_WORDS.has(t) && !/\d/.test(t) && t.length >= 3);

  if (alphaTokens.length > 0) return alphaTokens;

  return rawTokens.filter((t) => !STOP_WORDS.has(t) && t.length >= 3);
}

/**
 * Extrai o radical de um token, normalizando diminutivos e plurais comuns
 * em português. Réplica exata do `BingImageSearchProvider.GetStem`.
 */
export function getStem(token: string): string {
  const suffixes: [string, number][] = [
    ["zinhos", 6],
    ["zinhas", 6],
    ["zinho", 5],
    ["zinha", 5],
    ["inhos", 5],
    ["inhas", 5],
    ["inho", 4],
    ["inha", 4],
  ];

  for (const [suffix, len] of suffixes) {
    if (token.endsWith(suffix) && token.length - len >= 3) {
      return token.slice(0, -len);
    }
  }

  if (token.endsWith("es") && token.length > 4) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 3 && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }

  return token;
}

/**
 * Compara dois tokens por igualdade, radical ou prefixo compartilhado.
 * Réplica exata do `BingImageSearchProvider.TokenMatches`.
 */
function tokenMatches(queryToken: string, titleToken: string): boolean {
  if (queryToken === titleToken) return true;

  const qStem = getStem(queryToken);
  const tStem = getStem(titleToken);
  if (qStem === tStem) return true;
  if (qStem.length >= 3 && titleToken.startsWith(qStem)) return true;
  if (tStem.length >= 3 && queryToken.startsWith(tStem)) return true;

  const minLen = Math.min(queryToken.length, titleToken.length);
  if (minLen >= 4 && queryToken.slice(0, 4) === titleToken.slice(0, 4)) return true;

  return false;
}

/**
 * Verifica se o título de um resultado é pertinente à query buscada.
 * Réplica exata do `BingImageSearchProvider.MatchesQuery`.
 */
export function matchesQuery(title: string, queryTokens: string[]): boolean {
  if (queryTokens.length === 0) return true;

  const titleTokens = tokenize(title);
  if (titleTokens.length === 0) return false;

  const matchedCount = queryTokens.filter((qt) => titleTokens.some((tt) => tokenMatches(qt, tt))).length;

  const minRequired =
    queryTokens.length === 1 ? 1 : queryTokens.length <= 3 ? 2 : Math.ceil(queryTokens.length / 2);

  return matchedCount >= minRequired;
}

/**
 * Extrai o `<title>` da página para diagnóstico.
 * Se o Bing servir o feed rotativo em vez de resultados, o título será
 * "Imagens do Bing" em vez de "<query> - Pesquisar Imagens".
 */
function extractPageTitle(html: string): string {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/is);
  return match ? match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim() : "";
}

/**
 * Verifica se a página retornada é de resultados (não o feed rotativo).
 */
function isSearchResultsPage(html: string): boolean {
  const title = extractPageTitle(html);
  return title.includes("Pesquisar Imagens") || title.includes("Search Images");
}

/**
 * Tenta extrair um campo de texto de um JSON parseado.
 */
function readString(obj: Record<string, unknown>, key: string): string | undefined {
  const val = obj[key];
  return typeof val === "string" ? val : undefined;
}

/**
 * Extrai resultados de imagem do HTML do Bing, filtrando por pertinência.
 */
export function parseResults(html: string, count: number, query: string): ImageSearchResult[] {
  if (!html || count <= 0) return [];

  const queryTokens = tokenize(query);
  const results: ImageSearchResult[] = [];

  let match: RegExpExecArray | null;
  const regex = new RegExp(IMAGE_BLOB_REGEX.source, IMAGE_BLOB_REGEX.flags);

  while ((match = regex.exec(html)) !== null) {
    if (results.length >= count) break;

    const blob = match[1]
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    let imageUrl: string | undefined;
    let thumbnailUrl: string | undefined;
    let title: string | undefined;

    try {
      const obj = JSON.parse(blob) as Record<string, unknown>;
      imageUrl = readString(obj, "murl");
      thumbnailUrl = readString(obj, "turl");
      title = readString(obj, "t") ?? readString(obj, "title") ?? readString(obj, "desc");
    } catch {
      continue;
    }

    if (!imageUrl || !title) continue;

    if (matchesQuery(title, queryTokens)) {
      results.push({
        imageUrl,
        thumbnailUrl: thumbnailUrl ?? imageUrl,
        title,
      });
    }
  }

  return results;
}

/**
 * Busca imagens no Bing via proxy da Vercel (client-side).
 *
 * A requisição sai do edge da Vercel, não do servidor backend, evitando
 * o bloqueio de IP de datacenter que causava resultados vazios.
 *
 * @param query Termo de busca (ex: "GRAMPOS DE CABELO ESTRELA")
 * @param count Máximo de resultados a retornar
 * @returns Lista de resultados filtrados por pertinência
 */
export async function searchBingClientSide(query: string, count: number): Promise<ImageSearchResult[]> {
  if (!query?.trim() || count <= 0) return [];

  const searchUrl = `/bing-images/search?q=${encodeURIComponent(query)}&setmkt=pt-BR&setlang=pt-BR&cc=BR&safesearch=strict`;

  try {
    const response = await fetch(searchUrl, {
      headers: {
        Accept: "text/html",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!response.ok) {
      console.warn(`[busca-imagens-client] HTTP ${response.status} para "${query}"`);
      return [];
    }

    const html = await response.text();

    if (!isSearchResultsPage(html)) {
      console.warn(`[busca-imagens-client] Bing redirecionou para feed: "${query}"`);
      return [];
    }

    const results = parseResults(html, count, query);
    console.info(`[busca-imagens-client] "${query}" -> ${results.length} resultados`);
    return results;
  } catch (error) {
    console.warn(`[busca-imagens-client] Erro ao buscar "${query}":`, error);
    return [];
  }
}

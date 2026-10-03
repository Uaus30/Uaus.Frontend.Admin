import { useMutation, type UseMutationOptions } from "@tanstack/react-query";
import {
  AuthSession,
  ApiResponse,
  BackendPagedResult,
  PasswordChangedDto,
  UiPagedResult,
  UserDto,
} from "./models";
const AUTH_STORAGE_KEY = "uaus-office-auth";

export const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL) ||
  (typeof window !== "undefined" ? "/api" : "https://api.uaus.com.br");

export class ApiError extends Error {
  status: number;
  payload: unknown;
  method?: string;
  url?: string;

  constructor(message: string, status: number, payload: unknown, method?: string, url?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
    this.method = method;
    this.url = url;
  }
}

export function buildUrl(path: string, params?: Record<string, unknown>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = API_BASE_URL.startsWith("http")
    ? API_BASE_URL
    : typeof window !== "undefined"
      ? new URL(API_BASE_URL, window.location.origin).toString()
      : API_BASE_URL;
  const url = new URL(`${baseUrl}${normalizedPath}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || value === "") return;
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

async function readResponseBody(response: Response) {
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractErrorMessage(payload: unknown, fallback: string) {
  if (typeof payload === "string" && payload.trim()) return payload;

  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    const candidateKeys = ["message", "Message", "detail", "Detail", "title", "Title", "error", "Error"];
    for (const key of candidateKeys) {
      const value = obj[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }

  return fallback;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setAuthSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;

  if (!session) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));

  // Sessão recém-gravada (login, renovação, troca de senha) traz token novo:
  // renová-lo de novo na requisição seguinte seria ida ao servidor à toa.
  nextSessionRenewalAt = Date.now() + SESSION_RENEWAL_INTERVAL_MS;
}

export function clearAuthSession() {
  setAuthSession(null);
}

/**
 * Grava na sessão o resultado da troca de senha: o usuário atualizado e, quando
 * o servidor manda, o token novo.
 *
 * O token antigo morre na troca. Sem gravar o novo, a próxima requisição
 * responderia 401 e a pessoa cairia no login logo depois de trocar a senha.
 *
 * @returns O usuário, sem o token — é o que as telas guardam.
 */
export function applyPasswordChange(changed: PasswordChangedDto): UserDto {
  const { token, ...user } = changed;
  const session = getAuthSession();

  if (session) setAuthSession({ user, token: token ?? session.token });

  return user;
}

export function isTokenExpired(session: AuthSession | null) {
  if (!session?.token.expiration) return true;
  return new Date(session.token.expiration).getTime() <= Date.now();
}

/**
 * Caminho da autenticação. O 401 dele é credencial errada no formulário de
 * login (ou autorização gerencial recusada), nunca sessão expirada — por isso
 * ele fica fora do redirecionamento global do 401.
 */
const AUTHENTICATE_PATH = "/Users/authenticate";

/**
 * Garante um único redirecionamento por sessão expirada: uma tela costuma ter
 * várias queries em voo, e todas respondem 401 juntas quando o token vence.
 */
let redirectedToLoginAfter401 = false;

/**
 * Rearma o redirecionamento do 401. Só os testes precisam disto: no navegador
 * a navegação para o login recarrega a página e o módulo renasce zerado.
 */
export function resetUnauthorizedRedirect() {
  redirectedToLoginAfter401 = false;
}

/** URL da tela de login preservando o BASE_URL do deploy (ex.: "/pdv/" vira "/pdv/login"). */
function buildLoginUrl() {
  const base =
    (typeof import.meta !== "undefined" &&
      (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.BASE_URL) ||
    "/";
  return `${base.replace(/\/+$/, "")}/login`;
}

/**
 * Trata o 401 de uma requisição autenticada: o servidor recusou o token
 * (expirado, de conta sem acesso ou anterior a uma troca de senha), então a
 * sessão local é limpa e o app volta para a tela de login em vez de deixar o
 * usuário clicando numa tela morta.
 *
 * De propósito, NADA além do localStorage de autenticação é tocado — as filas
 * offline do PDV (IndexedDB) ficam intactas para sincronizar as vendas
 * pendentes depois do novo login.
 *
 * @param sentToken Token que a requisição recusada levava. Se a sessão guardada
 * já é outra, o 401 fala de um token que ninguém usa mais e é ignorado: a
 * troca de senha substitui o token, e uma requisição ainda em voo com o
 * anterior derrubaria a sessão que acabou de nascer.
 */
function handleUnauthorized(sentToken: string | undefined) {
  if (getAuthSession()?.token.value !== sentToken) return;

  clearAuthSession();

  // `typeof` protege ambientes sem navegador (SSR e utilitários de build).
  if (typeof window === "undefined" || redirectedToLoginAfter401) return;

  const loginUrl = buildLoginUrl();

  // Já estar no login (um 401 de query em segundo plano) não pode virar um
  // laço de recarregamentos da própria tela de login.
  if (window.location.pathname === loginUrl) return;

  redirectedToLoginAfter401 = true;
  window.location.assign(loginUrl);
}

/** Caminho da renovação: troca o token da sessão por um novo, com a validade cheia. */
const RENEW_SESSION_PATH = "/Users/renew-session";

/** Caminho da troca de senha, cuja resposta já traz o token novo. */
const CHANGE_PASSWORD_PATH = "/Users/change-password";

/**
 * De quanto em quanto tempo a sessão é renovada numa página que fica aberta.
 *
 * O token vale 7 dias a contar da última renovação, então uma hora de folga não
 * muda nada no prazo — e é também de hora em hora que uma mudança no cadastro
 * do usuário (nome, papel) chega ao aparelho sem novo login.
 */
export const SESSION_RENEWAL_INTERVAL_MS = 60 * 60 * 1000;

/** Espera depois de uma renovação que falhou (sem rede, servidor fora). */
const SESSION_RENEWAL_RETRY_MS = 60 * 1000;

/**
 * Quando a próxima renovação fica devida. Zero na carga do módulo: toda
 * abertura do app renova na primeira requisição autenticada — é o "acessou,
 * ganhou mais 7 dias" que o app instalado no celular precisa.
 */
let nextSessionRenewalAt = 0;

/**
 * Volta ao estado de página recém-aberta, com a renovação devida. Só os testes
 * precisam disto: no navegador é o recarregamento que zera o módulo.
 */
export function resetSessionRenewal() {
  nextSessionRenewalAt = 0;
}

/**
 * Troca o token da sessão por um novo, com a validade cheia, e atualiza o
 * usuário guardado com o cadastro atual.
 *
 * Sessão recusada pelo servidor (401) segue o caminho de sempre: limpa e leva
 * ao login. Qualquer outra falha é lançada e NÃO mexe na sessão — ficar sem
 * rede não desloga ninguém; o token em uso continua valendo até vencer.
 *
 * @returns A sessão renovada, ou `null` se não havia o que renovar.
 */
export async function renewSession(): Promise<AuthSession | null> {
  const current = getAuthSession();
  if (!current?.token.value) return null;

  const { data: renewed } = await apiRequest<AuthSession>("POST", RENEW_SESSION_PATH);
  if (!renewed?.token?.value) return null;

  // A resposta pode chegar depois de um logout ou da troca de usuário. Gravar
  // assim mesmo ressuscitaria a sessão de quem acabou de sair.
  if (getAuthSession()?.token.value !== current.token.value) return null;

  setAuthSession(renewed);
  return renewed;
}

/**
 * Renova a sessão em segundo plano, se já estiver na hora.
 *
 * Chamado depois de toda requisição autenticada bem-sucedida: é o uso do
 * sistema que mantém a sessão viva, sem cada app precisar lembrar de renovar.
 */
function renewSessionIfDue() {
  if (Date.now() < nextSessionRenewalAt) return;

  // Marcado ANTES de enviar: uma tela dispara várias queries juntas, e todas
  // passam por aqui. O sucesso empurra o prazo para a próxima hora (em
  // `setAuthSession`); a falha deixa este, curto, para tentar de novo.
  nextSessionRenewalAt = Date.now() + SESSION_RENEWAL_RETRY_MS;

  renewSession().catch(() => {
    // Falha de rede ou do servidor não é problema de quem está usando a tela.
    // O 401 já foi tratado dentro do `apiRequest`.
  });
}

export async function apiRequest<T>(
  method: string,
  path: string,
  options?: {
    params?: Record<string, unknown>;
    body?: unknown;
    headers?: HeadersInit;
    auth?: boolean;
  },
): Promise<ApiResponse<T>> {
  const session = getAuthSession();
  const headers = new Headers(options?.headers);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (options?.body != null && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const sentToken = options?.auth !== false ? session?.token.value || undefined : undefined;
  if (sentToken) {
    headers.set("Authorization", `Bearer ${sentToken}`);
  }

  const response = await fetch(buildUrl(path, options?.params), {
    method,
    headers,
    body:
      options?.body == null
        ? undefined
        : headers.get("Content-Type") === "application/json"
          ? JSON.stringify(options.body)
          : (options.body as BodyInit),
  });

  const payload = await readResponseBody(response);

  if (!response.ok) {
    // 401 numa chamada autenticada significa token recusado pelo servidor. O
    // login (`auth: false`) fica de fora: ali o 401 é credencial errada, e
    // redirecionar apagaria a mensagem de erro do formulário.
    if (response.status === 401 && options?.auth !== false && normalizedPath !== AUTHENTICATE_PATH) {
      handleUnauthorized(sentToken);
    }

    const fallback = `Erro ${response.status} ao acessar ${path}`;
    throw new ApiError(extractErrorMessage(payload, fallback), response.status, payload, method, path);
  }

  // O servidor acabou de aceitar o token: é a hora de trocá-lo por um novo, se
  // já estiver devido. Ficam de fora a própria renovação e a troca de senha,
  // que devolvem o token novo na resposta.
  if (sentToken && normalizedPath !== RENEW_SESSION_PATH && normalizedPath !== CHANGE_PASSWORD_PATH) {
    renewSessionIfDue();
  }

  return {
    data: payload as T | null,
    response,
  };
}

/**
 * GET que pode não trazer corpo.
 *
 * Devolve `null` em HTTP 204 e em resposta com corpo vazio — que é o que o
 * backend faz quando o recurso não existe. A assinatura antes mentia (`as T`),
 * apagando a nulidade que o próprio `apiRequest` produz, e o resultado é que a
 * tela recebia `undefined` onde o tipo prometia um objeto e quebrava ao ler um
 * campo. Havia até `?? []` em call sites que o TypeScript considerava código
 * morto, prova de que o autor sabia e contornava caso a caso.
 *
 * Use este quando a ausência é uma resposta legítima — busca por código,
 * consulta de um recurso que pode não existir. Quando a ausência é erro do
 * servidor (listagem paginada, por exemplo), use `apiGetOrThrow`.
 */
export async function apiGet<T>(
  path: string,
  params?: Record<string, unknown>,
  options?: { auth?: boolean; headers?: HeadersInit },
): Promise<T | null> {
  const result = await apiRequest<T>("GET", path, {
    params,
    auth: options?.auth,
    headers: options?.headers,
  });
  return result.data;
}

/**
 * GET para endpoints em que corpo vazio é erro, não resposta.
 *
 * Uma listagem paginada que volta sem corpo é falha do servidor, e propagar
 * `null` dali só empurra o problema para dentro da tela. Aqui ele vira `ApiError`
 * na hora, com o path na mensagem.
 *
 * @throws {ApiError} Quando a resposta vem sem corpo.
 */
export async function apiGetOrThrow<T>(
  path: string,
  params?: Record<string, unknown>,
  options?: { auth?: boolean; headers?: HeadersInit },
): Promise<T> {
  const data = await apiGet<T>(path, params, options);

  if (data == null) {
    throw new ApiError(`A resposta de ${path} veio sem conteúdo.`, 204, null, "GET", path);
  }

  return data;
}

/** Arquivo baixado da API, com o nome sugerido pelo servidor. */
export interface ApiBlob {
  blob: Blob;
  /** Nome vindo do `Content-Disposition`, ou o padrão informado. */
  fileName: string;
}

/**
 * GET de arquivo binário — planilha, imagem, PDF.
 *
 * Existe porque três pontos do admin montavam `fetch` com o header
 * `Authorization` NA MÃO para baixar binário. Além da duplicação, isso os
 * deixava fora do tratamento centralizado de 401: o token vencia, a requisição
 * falhava com um erro genérico e o usuário continuava numa tela morta em vez de
 * ser levado ao login.
 *
 * @param path Caminho no backend, ou URL absoluta (o proxy de imagem já vem pronto).
 * @param fallbackFileName Nome usado quando o servidor não manda `Content-Disposition`.
 */
export async function apiGetBlob(
  path: string,
  fallbackFileName: string,
  options?: { params?: Record<string, unknown> },
): Promise<ApiBlob> {
  const session = getAuthSession();
  const headers = new Headers();

  if (session?.token.value) {
    headers.set("Authorization", `Bearer ${session.token.value}`);
  }

  // A URL pode vir absoluta (proxy de imagem) ou como caminho do backend.
  const url = path.startsWith("http") ? path : buildUrl(path, options?.params);
  const response = await fetch(url, { method: "GET", headers });

  if (!response.ok) {
    if (response.status === 401) handleUnauthorized(session?.token.value || undefined);

    throw new ApiError(`Erro ${response.status} ao baixar ${path}`, response.status, null, "GET", path);
  }

  return {
    blob: await response.blob(),
    fileName: fileNameFromResponse(response) ?? fallbackFileName,
  };
}

/**
 * Lê o nome do arquivo do cabeçalho `Content-Disposition`, se houver.
 *
 * O ASP.NET manda os DOIS formatos quando o nome tem acento, nesta ordem:
 * `attachment; filename=relatorio.xlsx; filename*=UTF-8''relat%C3%B3rio.xlsx`.
 * O primeiro é o fallback ASCII para cliente antigo; o segundo é o nome de
 * verdade. A RFC 6266 manda preferir o `filename*`, e uma regex única sobre o
 * cabeçalho inteiro casaria com o que vem primeiro — o acentuado seria perdido
 * justamente nos relatórios em português, que são quase todos.
 *
 * O `decodeURIComponent` vai dentro de try/catch porque ele **lança** em nome
 * com `%` literal: "desconto 50%.pdf" vira `URIError: URI malformed`. Sem a
 * proteção o erro escapa do `apiGetBlob` e o download inteiro falha, em vez de
 * cair no nome de reserva — o usuário fica sem a planilha por causa do nome dela.
 */
function fileNameFromResponse(response: Response): string | null {
  const disposition = response.headers.get("Content-Disposition");
  if (!disposition) return null;

  const extended = disposition.match(/filename\*=\s*(?:UTF-8'[^']*')?"?([^";]+)"?/i);
  const plain = disposition.match(/filename=\s*"?([^";]+)"?/i);
  const raw = (extended?.[1] ?? plain?.[1])?.trim();
  if (!raw) return null;

  try {
    return decodeURIComponent(raw);
  } catch {
    // Nome que não é percent-encoding válido é usado como veio: melhor o nome
    // literal do servidor que nenhum arquivo.
    return raw;
  }
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  options?: { auth?: boolean; headers?: HeadersInit },
) {
  const result = await apiRequest<T>("POST", path, {
    body,
    auth: options?.auth,
    headers: options?.headers,
  });
  return result;
}

export async function apiPut<T>(
  path: string,
  body?: unknown,
  options?: { auth?: boolean; headers?: HeadersInit },
) {
  const result = await apiRequest<T>("PUT", path, {
    body,
    auth: options?.auth,
    headers: options?.headers,
  });
  return result;
}

export async function apiDelete<T>(path: string, options?: { auth?: boolean; headers?: HeadersInit }) {
  const result = await apiRequest<T>("DELETE", path, {
    auth: options?.auth,
    headers: options?.headers,
  });
  return result;
}

export function extractCreatedId(response: Response) {
  const location = response.headers.get("Location");
  if (!location) return null;

  const match = location.match(/\/(\d+)(?:\?.*)?$/);
  return match ? Number(match[1]) : null;
}

export function mapPagedResult<T>(result: BackendPagedResult<T>): UiPagedResult<T> {
  const page = result.pagination.page ?? 1;
  const limit = result.pagination.size ?? result.items.length;
  const total = result.pagination.filteredItems ?? result.items.length;

  return {
    data: result.items,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / Math.max(1, limit))),
  };
}

/**
 * Teto de itens que `fetchAllPages` aceita varrer.
 *
 * É rede de segurança contra catástrofe, não regra de estilo — por isso o número
 * é alto. O teto foi posto onde o NAVEGADOR desiste, não onde o desenho começa a
 * ficar feio: 20 mil linhas de venda passam de 100 páginas e dezenas de MB de
 * JSON vivo na aba. Abaixo disso a varredura é lenta mas funciona, e derrubar a
 * tela de quem tem 6 mil vendas seria trocar um problema de performance por um
 * problema de disponibilidade.
 *
 * Passar daqui não é "muitos dados": é a varredura completa ter deixado de ser a
 * ferramenta certa para aquele endpoint. Quem chega neste ponto precisa de
 * filtro ou agregação no servidor.
 */
export const FETCH_ALL_PAGES_MAX_ITEMS = 20000;

/**
 * Quantas páginas são pedidas ao mesmo tempo.
 *
 * A versão anterior montava um `Promise.all` com TODAS as páginas restantes. Em
 * `/Sales`, que cresce para sempre, dois anos de operação viram centenas de
 * requisições disparadas no mesmo tick: o navegador enfileira (6 por origem) e
 * as demais ficam pendentes segurando memória, enquanto a API leva a rajada
 * inteira de uma vez. Seis é o que o próprio navegador executaria em paralelo —
 * o resto era fila disfarçada de concorrência.
 */
const FETCH_ALL_PAGES_CONCURRENCY = 6;

export interface FetchAllPagesOptions {
  /** Sobrescreve {@link FETCH_ALL_PAGES_MAX_ITEMS} para um caso específico. */
  maxItems?: number;
}

/**
 * Varre todas as páginas de um endpoint paginado e devolve os itens somados.
 *
 * Serve para os catálogos pequenos e estáveis que a tela precisa inteiros —
 * departamentos, categorias, etiquetas — onde paginar na interface só
 * atrapalharia.
 *
 * **Falha em vez de truncar.** Passando do teto, a função lança. Devolver os
 * primeiros N seria a pior saída possível: o resultado alimenta combo de seleção
 * e soma de relatório, e uma lista cortada pela metade não parece quebrada —
 * parece que o cliente não existe, que a venda não aconteceu, que o faturamento
 * caiu. Erro na tela o desenvolvedor conserta; número errado com cara de certo
 * ninguém percebe.
 *
 * @param path Caminho do endpoint paginado.
 * @param params Filtros repassados em toda página.
 * @param size Tamanho da página pedida ao servidor.
 * @param options Teto de itens, quando o padrão não serve.
 * @throws Se o total informado pelo servidor passar do teto.
 */
export async function fetchAllPages<T>(
  path: string,
  params?: Record<string, unknown>,
  size = 200,
  options?: FetchAllPagesOptions,
): Promise<T[]> {
  const maxItems = options?.maxItems ?? FETCH_ALL_PAGES_MAX_ITEMS;

  // A primeira página traz o total: é ela que diz se vale continuar.
  const firstPage = await apiGetOrThrow<BackendPagedResult<T>>(path, {
    ...params,
    page: 1,
    size,
  });

  const allItems: T[] = [...firstPage.items];
  const total = firstPage.pagination.filteredItems ?? allItems.length;

  if (total > maxItems) {
    throw new Error(
      `${path} tem ${total} itens e passou do teto de ${maxItems} da varredura completa. ` +
        `Esta lista precisa de filtro ou paginação no servidor — carregá-la inteira ` +
        `no navegador deixou de ser viável.`,
    );
  }

  if (allItems.length >= total || firstPage.items.length === 0) {
    return allItems;
  }

  // As páginas restantes vão numa janela fixa. A ordem do resultado segue a das
  // páginas porque cada uma escreve na sua posição, não na ordem em que chega —
  // sem isso a lista sairia embaralhada conforme a latência de cada requisição.
  const totalPages = Math.ceil(total / size);
  const pages: number[] = [];
  for (let page = 2; page <= totalPages; page++) pages.push(page);

  const collected: T[][] = new Array(pages.length);
  let next = 0;

  const worker = async () => {
    while (next < pages.length) {
      const index = next++;
      const paged = await apiGetOrThrow<BackendPagedResult<T>>(path, {
        ...params,
        page: pages[index],
        size,
      });
      collected[index] = paged.items;
    }
  };

  await Promise.all(Array.from({ length: Math.min(FETCH_ALL_PAGES_CONCURRENCY, pages.length) }, worker));

  for (const items of collected) {
    if (items) allItems.push(...items);
  }

  return allItems;
}

export function useCrudMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    mutation?: UseMutationOptions<TData, ApiError, TVariables>;
  },
) {
  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    ...options?.mutation,
  });
}

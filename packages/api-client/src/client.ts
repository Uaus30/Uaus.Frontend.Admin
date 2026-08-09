import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { AuthSession, ApiResponse, BackendPagedResult, UiPagedResult } from './models';
const AUTH_STORAGE_KEY = "uaus-office-auth";

export const API_BASE_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
      ?.VITE_API_BASE_URL) ||
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
    const candidateKeys = [
      "message", "Message",
      "detail", "Detail",
      "title", "Title",
      "error", "Error"
    ];
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
}

export function clearAuthSession() {
  setAuthSession(null);
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
      (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
        ?.BASE_URL) ||
    "/";
  return `${base.replace(/\/+$/, "")}/login`;
}

/**
 * Trata o 401 de uma requisição autenticada: o servidor recusou o token
 * (expirado ou inválido), então a sessão local é limpa e o app volta para a
 * tela de login em vez de deixar o usuário clicando numa tela morta.
 *
 * De propósito, NADA além do localStorage de autenticação é tocado — as filas
 * offline do PDV (IndexedDB) ficam intactas para sincronizar as vendas
 * pendentes depois do novo login.
 */
function handleUnauthorized() {
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

  if (options?.body != null && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  if (options?.auth !== false && session?.token.value) {
    headers.set("Authorization", `Bearer ${session.token.value}`);
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
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    if (response.status === 401 && options?.auth !== false && normalizedPath !== AUTHENTICATE_PATH) {
      handleUnauthorized();
    }

    const fallback = `Erro ${response.status} ao acessar ${path}`;
    throw new ApiError(extractErrorMessage(payload, fallback), response.status, payload, method, path);
  }

  return {
    data: payload as T | null,
    response,
  };
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, unknown>,
  options?: { auth?: boolean; headers?: HeadersInit },
) {
  const result = await apiRequest<T>("GET", path, {
    params,
    auth: options?.auth,
    headers: options?.headers,
  });
  return result.data as T;
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

export async function apiDelete<T>(
  path: string,
  options?: { auth?: boolean; headers?: HeadersInit },
) {
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

export async function fetchAllPages<T>(
  path: string,
  params?: Record<string, unknown>,
  size = 200,
) {
  const allItems: T[] = [];
  let page = 1;

  while (true) {
    const paged = await apiGet<BackendPagedResult<T>>(path, {
      ...params,
      page,
      size,
    });

    allItems.push(...paged.items);

    const total = paged.pagination.filteredItems ?? allItems.length;
    if (allItems.length >= total || paged.items.length === 0) break;
    page += 1;
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







import { createLog, ApiError } from "@workspace/api-client-react";

/**
 * Intervalo de deduplicação em milissegundos.
 * Erros idênticos dentro desta janela são descartados para não sobrecarregar o backend.
 */
const DEDUPLICATION_WINDOW_MS = 5000;

/** Cache de impressões digitais de erros recentes com timestamp da ocorrência. */
const recentErrorFingerprints = new Map<string, number>();

/** Trava para evitar loops infinitos caso a chamada ao endpoint de logs falhe. */
let isLoggingInProgress = false;

/**
 * Reseta o estado interno do logger (usado em testes).
 */
export function resetClientLoggerState() {
  recentErrorFingerprints.clear();
  isLoggingInProgress = false;
}

/**
 * Gera uma chave única (fingerprint) para deduplicação baseada na mensagem e stack.
 */
function getErrorFingerprint(message: string, stack?: string): string {
  return `${message}::${stack?.slice(0, 200) ?? ""}`;
}

/**
 * Verifica se um erro deve ser ignorado para evitar poluição do banco.
 * - 401 Unauthorized (sessão expirada tratada pelo fluxo de login).
 * - Falhas de rede quando o navegador está offline.
 * - AbortError (requisições canceladas pelo usuário ou cleanup de componentes).
 */
function shouldIgnoreError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }

  if (error instanceof ApiError) {
    if (error.status === 401) return true;
    if (error.url?.includes("/Logs")) return true;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return true;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  return false;
}

/**
 * Extrai a mensagem legível de um erro genérico.
 */
function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return "Erro não serializável";
    }
  }
  return "Erro desconhecido no cliente";
}

/**
 * Extrai o stack trace ou informações detalhadas do erro.
 */
function extractDetails(
  error: unknown,
  extraDetails?: Record<string, unknown>,
): string {
  const detailsObj: Record<string, unknown> = {
    ...extraDetails,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    pathname: typeof window !== "undefined" ? window.location.pathname : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    timestamp: new Date().toISOString(),
  };

  if (error instanceof ApiError) {
    detailsObj.apiStatus = error.status;
    detailsObj.apiMethod = error.method;
    detailsObj.apiUrl = error.url;
    detailsObj.apiPayload = error.payload;
  }

  if (error instanceof Error) {
    detailsObj.errorName = error.name;
    detailsObj.stack = error.stack;
  }

  try {
    return JSON.stringify(detailsObj, null, 2);
  } catch {
    return String(error);
  }
}

export interface ReportErrorOptions {
  /** Origem customizada do log (ex: "[Front-Admin] /produtos"). */
  origin?: string;
  /** Tipo numérico do log (1=Info, 2=Alert, 3=Error, 4=Critical). Padrão é 3 (Error). */
  type?: number;
  /** Metadados adicionais para contexto do erro. */
  extraDetails?: Record<string, unknown>;
}

/**
 * Reporta um erro do frontend para o backend de forma segura e com proteção contra loops.
 *
 * @param error O erro ou exceção capturado.
 * @param options Opções de contexto e origem do erro.
 */
export async function reportClientError(
  error: unknown,
  options?: ReportErrorOptions,
): Promise<boolean> {
  if (isLoggingInProgress || shouldIgnoreError(error)) {
    return false;
  }

  const message = extractMessage(error);
  const stack = error instanceof Error ? error.stack : undefined;
  const fingerprint = getErrorFingerprint(message, stack);
  const now = Date.now();

  const lastLogged = recentErrorFingerprints.get(fingerprint);
  if (lastLogged && now - lastLogged < DEDUPLICATION_WINDOW_MS) {
    return false;
  }

  recentErrorFingerprints.set(fingerprint, now);

  // Limpeza preventiva de fingerprints antigos
  if (recentErrorFingerprints.size > 100) {
    for (const [key, time] of recentErrorFingerprints.entries()) {
      if (now - time > DEDUPLICATION_WINDOW_MS * 2) {
        recentErrorFingerprints.delete(key);
      }
    }
  }

  const defaultOrigin =
    typeof window !== "undefined"
      ? `[Front-Admin] ${window.location.pathname}`
      : "[Front-Admin]";

  const origin = options?.origin || defaultOrigin;
  const details = extractDetails(error, options?.extraDetails);
  const type = options?.type ?? 3; // 3 = Error

  isLoggingInProgress = true;
  try {
    await createLog({
      type,
      origin,
      message,
      details,
    });
    return true;
  } catch (err) {
    // Falha ao reportar log não deve quebrar a aplicação nem entrar em loop
    console.warn("Falha ao enviar log para o backend:", err);
    return false;
  } finally {
    isLoggingInProgress = false;
  }
}

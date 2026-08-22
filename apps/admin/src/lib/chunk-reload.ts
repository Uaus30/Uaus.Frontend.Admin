/**
 * Chave utilizada no sessionStorage para evitar loop infinito de recargas
 * caso o erro persista (ex: servidor indisponível ou queda real de conexão).
 */
export const CHUNK_RELOAD_STORAGE_KEY = "uaus:chunk-reload-ts";

/** Janela de tempo (em milissegundos) para suprimir reloads repetidos. */
export const CHUNK_RELOAD_INTERVAL_MS = 10_000;

/**
 * Identifica se uma exceção decorre de falha no download de um chunk JavaScript/CSS
 * gerado por importação dinâmica (React.lazy / dynamic import) pós-deploy.
 *
 * Diferentes motores e navegadores utilizam textos ligeiramente distintos:
 * - Chromium/Chrome/Edge: "Failed to fetch dynamically imported module"
 * - Safari/WebKit: "Importing a module script failed" / "Load failed"
 * - Firefox/outros: "error loading dynamically imported module" / "Loading chunk [...] failed"
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;

  const message =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : "";

  return (
    /failed to fetch dynamically imported module/i.test(message) ||
    /importing a module script failed/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /loading chunk .* failed/i.test(message) ||
    /loading css chunk .* failed/i.test(message)
  );
}

/**
 * Verifica se uma recarga automática de página foi acionada recentemente.
 */
function hasRecentChunkReload(): boolean {
  if (typeof window === "undefined" || !window.sessionStorage) return false;

  try {
    const raw = window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY);
    if (!raw) return false;

    const timestamp = Number(raw);
    if (Number.isNaN(timestamp)) return false;

    return Date.now() - timestamp < CHUNK_RELOAD_INTERVAL_MS;
  } catch {
    return false;
  }
}

/**
 * Registra a tentativa de recarga atual no sessionStorage.
 */
function recordChunkReload(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;

  try {
    window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignora restrições de armazenamento local
  }
}

/**
 * Dispara uma recarga segura da página caso a falha seja de chunk e ainda não
 * tenha havido recarga recente.
 *
 * @param error Erro capturado opcional para validação prévia.
 * @returns `true` se o reload foi disparado, `false` se ignorado ou bloqueado pela trava.
 */
export function reloadOnChunkLoadError(error?: unknown): boolean {
  if (error !== undefined && !isChunkLoadError(error)) {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  if (hasRecentChunkReload()) {
    // Já tentou recarregar nos últimos segundos e o erro persistiu.
    // Não recarrega novamente para não travar o navegador em loop.
    return false;
  }

  recordChunkReload();
  window.location.reload();
  return true;
}

/**
 * Registra o ouvinte para o evento nativo `vite:preloadError` disparado pelo Vite
 * quando um dynamic import falha durante a execução do aplicativo.
 */
export function setupChunkLoadErrorHandler(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event) => {
    // Previne que o erro padrão não tratado seja emitido antes da recarga
    event.preventDefault();
    reloadOnChunkLoadError();
  });
}

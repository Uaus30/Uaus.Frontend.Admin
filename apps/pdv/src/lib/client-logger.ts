import { createLog } from "@workspace/api-client-react";

/**
 * Envio de erro do PDV para o log do servidor.
 *
 * Existe porque o balcão era o único app que quebrava em SILÊNCIO: sem
 * `ErrorBoundary` e sem log, um crash de render deixava a tela preta e nada
 * chegava ao servidor — o diagnóstico dependia de alguém descrever o que viu.
 *
 * É uma versão enxuta do `clientLogger` do admin, e de propósito: o PDV opera
 * offline por projeto, então tudo aqui é best-effort. Log que falha nunca pode
 * atrapalhar a venda.
 */

/** Janela de deduplicação: o mesmo erro repetido não vira dez linhas no banco. */
const DEDUPLICATION_WINDOW_MS = 5000;

/** Impressões digitais recentes, para não repetir o mesmo envio. */
const recentFingerprints = new Map<string, number>();

/** Trava contra laço: se o próprio envio falhar, não tenta logar a falha do log. */
let sending = false;

/** Limpa o estado interno. Usado nos testes. */
export function resetPdvLoggerState() {
  recentFingerprints.clear();
  sending = false;
}

function fingerprintOf(message: string, stack?: string) {
  return `${message}::${stack?.slice(0, 200) ?? ""}`;
}

/**
 * Registra um erro do PDV no servidor.
 *
 * Offline não tenta: o operador segue vendendo pela base local, e uma requisição
 * fadada a falhar só gastaria tempo do caixa.
 *
 * @param error Erro capturado.
 * @param options Origem e metadados extras (por exemplo, o componentStack).
 */
export async function reportPdvError(
  error: unknown,
  options: { origin: string; extraDetails?: Record<string, unknown> },
): Promise<void> {
  if (sending) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;

  const message =
    error instanceof Error ? error.message || error.name : String(error ?? "Erro desconhecido no PDV");
  const stack = error instanceof Error ? error.stack : undefined;

  const fingerprint = fingerprintOf(message, stack);
  const now = Date.now();
  const last = recentFingerprints.get(fingerprint);
  if (last !== undefined && now - last < DEDUPLICATION_WINDOW_MS) return;
  recentFingerprints.set(fingerprint, now);

  const details = {
    ...options.extraDetails,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    timestamp: new Date().toISOString(),
    errorName: error instanceof Error ? error.name : undefined,
    stack,
  };

  sending = true;
  try {
    await createLog({
      // 4 = Critical, o mesmo código que o admin usa para crash de renderização.
      type: 4,
      origin: options.origin,
      message,
      details: JSON.stringify(details, null, 2),
    });
  } catch {
    // Silêncio proposital: o log é diagnóstico, não parte da venda.
  } finally {
    sending = false;
  }
}

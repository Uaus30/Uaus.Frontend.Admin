import { buildUrl } from "@workspace/api-client-react";
import { MetricsCollector, type CollectorDeps, type SiteEventBatch } from "./collector";

/**
 * O coletor ligado ao navegador de verdade. Um só por página; nasce na
 * primeira chamada, para o teste de componente que não chama nada não tocar
 * `localStorage`.
 *
 * O transporte é `sendBeacon`: o navegador entrega mesmo com a página saindo,
 * que é exatamente o momento em que o último lote sai. Vai para a mesma origem
 * (`/api/Storefront/events`), então nenhum bloqueador de anúncio tem lista
 * para ele e não há CORS. Falhou? Descartado. Métrica nunca atrapalha a visita.
 */

const EVENTS_PATH = "/Storefront/events";

function sendBatch(batch: SiteEventBatch) {
  try {
    const url = buildUrl(EVENTS_PATH);
    const body = JSON.stringify(batch);

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      // Blob com o tipo certo: sendBeacon com string mandaria text/plain e o
      // [FromBody] da API recusaria.
      if (navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
    }

    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // sem rede, sem fetch, sem nada: a visita segue
  }
}

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Navegador sem randomUUID (WebView antiga): 32 hex de Math.random. Serve
  // como id anônimo; não é segurança.
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

let instance: MetricsCollector | null = null;

/** O coletor da página. Fora do navegador (teste sem DOM) devolve um coletor desligado. */
export function getCollector(): MetricsCollector {
  if (instance) return instance;

  const hasDom = typeof window !== "undefined" && typeof document !== "undefined";
  const noStorage = { getItem: () => null, setItem: () => undefined, removeItem: () => undefined };

  instance = new MetricsCollector({
    now: () => Date.now(),
    local: hasDom ? safeStorage(() => window.localStorage, noStorage) : noStorage,
    session: hasDom ? safeStorage(() => window.sessionStorage, noStorage) : noStorage,
    send: sendBatch,
    randomId,
    isVisible: () => !hasDom || document.visibilityState !== "hidden",
    referrer: () => (hasDom ? document.referrer : ""),
    search: () => (hasDom ? window.location.search : ""),
  });

  return instance;
}

/** Acessar `window.localStorage` LANÇA em alguns modos privados; aqui vira armazenamento vazio. */
function safeStorage(get: () => Storage, fallback: CollectorDeps["local"]): CollectorDeps["local"] {
  try {
    return get();
  } catch {
    return fallback;
  }
}

/** Clique em "Reservar pelo WhatsApp" — a conversão do site. */
export function trackReserveClick(productGroupId: number, variationName?: string) {
  getCollector().track("reserve_click", { productGroupId, detail: variationName });
}

/** Clique num WhatsApp de contato. `where` diz qual botão: cabeçalho, rodapé, formulário. */
export function trackContactClick(where: "cabecalho" | "rodape" | "formulario" | "telefone") {
  getCollector().track("contact_click", { detail: where });
}

/** Busca que chegou à URL (já com debounce). */
export function trackSearch(term: string) {
  const detail = term.trim();
  if (detail) getCollector().track("search", { detail });
}

import {
  loadSession,
  loadVisitor,
  resolveOptOut,
  SESSION_GAP_MS,
  touchSession,
  type CollectorStorage,
} from "./identity";

/**
 * O coletor de métricas do site — a parte que NÃO toca o navegador.
 *
 * Tudo o que depende de `window`, `document` e `navigator` entra por
 * `CollectorDeps`, para o coletor ser testável com relógio e armazenamento
 * falsos. Quem liga os dois é `index.ts`.
 *
 * As regras que ele implementa estão em `Uaus.Docs/dominio/metricas-do-site.md`
 * (decisões 5 a 8): eventos em lote, tempo VISÍVEL e não relógio de parede,
 * sessão nova depois de 30 min oculta, e falha descartada em silêncio —
 * métrica nunca atrapalha a visita.
 */

export { OPT_OUT_KEY, SESSION_GAP_MS, SESSION_KEY, VISITOR_KEY } from "./identity";

/** Nomes que o servidor conhece (`SiteVisitorRules.ParseType`). Nome fora daqui é descartado lá. */
export type SiteEventType =
  "page_view" | "product_view" | "search" | "reserve_click" | "contact_click" | "page_leave";

/** Um evento como vai no lote. Espelha `SiteEventInput` do backend. */
export interface SiteEventPayload {
  type: SiteEventType;
  /** ISO em UTC. O servidor só confia nele a menos de 10 min do relógio dele. */
  occurredAt: string;
  path: string;
  productGroupId?: number;
  durationMs?: number;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  detail?: string;
}

/** O lote. Espelha `RecordSiteEventsRequest`. */
export interface SiteEventBatch {
  visitorId: string;
  sessionId: string;
  events: SiteEventPayload[];
}

/** O que o coletor precisa do navegador. */
export interface CollectorDeps {
  now: () => number;
  local: CollectorStorage;
  session: CollectorStorage;
  /** Envia o lote. Nunca deve lançar; o coletor também não espera a resposta. */
  send: (batch: SiteEventBatch) => void;
  randomId: () => string;
  /** `document.visibilityState === "visible"` no instante da construção. */
  isVisible: () => boolean;
  /** Referenciador e query string da ENTRADA, para o primeiro `page_view`. */
  referrer: () => string;
  search: () => string;
}

/** Lote sai com este tanto de eventos… */
export const BATCH_SIZE = 10;
/** …ou depois deste tempo de atividade, o que vier primeiro. */
export const FLUSH_INTERVAL_MS = 15_000;
/** Sem toque, rolagem ou tecla por este tempo, o cronômetro pausa. */
export const IDLE_MS = 2 * 60_000;
/** Teto do tempo visível por página; o servidor aplica o mesmo. */
export const MAX_PAGE_MS = 30 * 60_000;

/**
 * Onde o visitante está e há quanto tempo a página está visível.
 *
 * `visibleMs` só cresce em `accrue()`, e `accrue()` só soma o trecho em que a
 * página estava visível E o visitante ativo. É isto que faz "deixou a aba
 * aberta três dias" contar zero.
 */
interface CurrentPage {
  path: string;
  productGroupId?: number;
  visibleMs: number;
  /** Instante do último `accrue()`; o próximo soma a partir daqui. */
  accruedAt: number;
}

export class MetricsCollector {
  private readonly deps: CollectorDeps;
  private readonly enabled: boolean;
  private readonly visitorId: string;
  private sessionId: string;
  private queue: SiteEventPayload[] = [];
  private page: CurrentPage | null = null;
  /** A última rota vista, para reabrir a página em silêncio quando a aba volta. */
  private lastRoute: { path: string; productGroupId?: number } | null = null;
  private lastActivity: number;
  private lastFlush: number;
  private hiddenAt: number | null = null;
  /** O primeiro `page_view` da sessão leva referenciador e UTM; os demais, não. */
  private entryPending: boolean;

  constructor(deps: CollectorDeps) {
    this.deps = deps;
    const now = deps.now();
    this.enabled = !resolveOptOut(deps.local, deps.search());
    this.visitorId = this.enabled ? loadVisitor(deps.local, deps.randomId) : "";
    const session = this.enabled ? loadSession(deps.session, now, deps.randomId) : { id: "", resumed: true };
    this.sessionId = session.id;
    this.entryPending = !session.resumed;
    this.lastActivity = now;
    this.lastFlush = now;
    // Página que nasce oculta (aba aberta em segundo plano) só começa a contar
    // quando aparecer.
    this.hiddenAt = deps.isVisible() ? null : now;
  }

  /** Falso quando o navegador está marcado com `?semmetricas`. Tudo vira no-op. */
  get isEnabled(): boolean {
    return this.enabled;
  }

  get currentSessionId(): string {
    return this.sessionId;
  }

  // ------------------------------------------------------------------ tempo

  /**
   * Soma ao cronômetro da página o trecho desde o último `accrue()`, mas só a
   * parte em que a página estava visível e o visitante ativo. O trecho depois
   * de `lastActivity + IDLE_MS` é tela esquecida e não conta.
   *
   * A visibilidade é o PRÓPRIO registro (`hiddenAt`), e não o estado atual do
   * documento: quando `hidden()` roda, o documento já está oculto, e o trecho
   * até ali — que foi visível — precisa entrar.
   */
  private accrue() {
    if (!this.page) return;
    const now = this.deps.now();
    if (this.hiddenAt === null) {
      const activeUntil = Math.min(now, this.lastActivity + IDLE_MS);
      const delta = Math.max(0, activeUntil - this.page.accruedAt);
      this.page.visibleMs = Math.min(MAX_PAGE_MS, this.page.visibleMs + delta);
    }
    this.page.accruedAt = now;
  }

  /** Toque, rolagem, tecla: o visitante está aí. Retoma o cronômetro se estava em pausa por inatividade. */
  activity() {
    if (!this.enabled) return;
    this.accrue();
    this.lastActivity = this.deps.now();
  }

  // --------------------------------------------------------------- eventos

  /**
   * Nova página na tela. Fecha a anterior com `page_leave` e abre a nova com
   * `page_view`. Em `/produtos/:id` sai também um `product_view`, para o
   * ranking de produtos não depender de interpretar rota.
   */
  pageView(path: string, productGroupId?: number) {
    if (!this.enabled) return;
    this.pageLeave();

    const now = this.deps.now();
    this.openPage(path, productGroupId, now);
    this.lastActivity = now;

    const event: SiteEventPayload = { type: "page_view", occurredAt: this.iso(now), path, productGroupId };
    if (this.entryPending) {
      Object.assign(event, this.entryContext());
      this.entryPending = false;
    }
    this.enqueue(event);

    if (productGroupId !== undefined) {
      this.enqueue({ type: "product_view", occurredAt: this.iso(now), path, productGroupId });
    }
  }

  private openPage(path: string, productGroupId: number | undefined, now: number) {
    this.page = { path, productGroupId, visibleMs: 0, accruedAt: now };
    this.lastRoute = { path, productGroupId };
  }

  /**
   * Fecha a página atual com o tempo visível acumulado. Idempotente: sem página
   * aberta, nada sai. A mesma rota pode fechar mais de uma vez na mesma sessão
   * (a aba ficou oculta e voltou): o servidor SOMA as durações por página.
   */
  pageLeave() {
    if (!this.enabled || !this.page) return;
    this.accrue();
    const { path, productGroupId, visibleMs } = this.page;
    this.page = null;
    this.enqueue({
      type: "page_leave",
      occurredAt: this.iso(this.deps.now()),
      path,
      productGroupId,
      durationMs: Math.round(visibleMs),
    });
  }

  /** Evento pontual na página atual: reserva, contato, busca. */
  track(
    type: Exclude<SiteEventType, "page_view" | "page_leave">,
    extra: { productGroupId?: number; detail?: string } = {},
  ) {
    if (!this.enabled) return;
    this.activity();
    const route = this.page ?? this.lastRoute;
    this.enqueue({
      type,
      occurredAt: this.iso(this.deps.now()),
      path: route?.path ?? "/",
      productGroupId: extra.productGroupId ?? route?.productGroupId,
      detail: extra.detail,
    });
  }

  // ----------------------------------------------------------- visibilidade

  /**
   * A página ficou oculta: trocou de aba, foi para a tela inicial, bloqueou a
   * tela, abriu o WhatsApp pelo botão de reserva. É o único sinal confiável no
   * celular — e é o último que muitas visitas dão: o sistema mata a aba em
   * segundo plano sem avisar. Por isso a página FECHA aqui, com o `page_leave`
   * e o tempo lido, e o lote sai. Se a pessoa voltar, a página reabre em
   * silêncio (`visible()`), e o tempo seguinte vira outro `page_leave` da mesma
   * rota, que o servidor soma.
   */
  hidden() {
    if (!this.enabled) return;
    this.pageLeave();
    this.hiddenAt = this.deps.now();
    this.flush();
  }

  /**
   * Voltou. Ausência curta reabre a página em silêncio, sem novo `page_view`.
   * Ausência maior que 30 min é visita nova: sessão nova e `page_view` da
   * página em que estava — sem referenciador nem UTM, que são da entrada
   * original e já foram contados uma vez.
   */
  visible() {
    if (!this.enabled) return;
    const now = this.deps.now();
    const away = this.hiddenAt === null ? 0 : now - this.hiddenAt;
    // Fecha a conta do trecho oculto ANTES de limpar a marca: com `hiddenAt`
    // marcado, `accrue` só move o ponteiro, sem somar. É o caso da aba aberta
    // em segundo plano ("abrir em nova aba") e vista dez minutos depois — sem
    // isto, os dez minutos entrariam como leitura.
    this.accrue();
    this.hiddenAt = null;
    this.lastActivity = now;

    if (away > SESSION_GAP_MS) {
      this.renewSession();
      if (this.lastRoute) this.pageView(this.lastRoute.path, this.lastRoute.productGroupId);
      return;
    }

    if (!this.page && this.lastRoute) {
      this.openPage(this.lastRoute.path, this.lastRoute.productGroupId, now);
    }
  }

  private renewSession() {
    this.flush();
    this.sessionId = this.deps.randomId();
    touchSession(this.deps.session, this.sessionId, this.deps.now());
    this.entryPending = false;
  }

  /** Saindo de verdade (`pagehide`): fecha a página e manda o que tem. */
  leave() {
    if (!this.enabled) return;
    this.pageLeave();
    this.flush();
  }

  /** Chamado a cada ~15 s enquanto a página está visível. Manda o que acumulou. */
  tick() {
    if (!this.enabled) return;
    this.accrue();
    if (this.queue.length > 0 && this.deps.now() - this.lastFlush >= FLUSH_INTERVAL_MS) this.flush();
  }

  // ------------------------------------------------------------------ envio

  private enqueue(event: SiteEventPayload) {
    this.queue.push(this.compact(event));
    if (this.queue.length >= BATCH_SIZE) this.flush();
  }

  /** Envia o lote agora e marca a sessão como viva. Nada sai com a fila vazia. */
  flush() {
    if (!this.enabled) return;
    const now = this.deps.now();
    this.lastFlush = now;
    touchSession(this.deps.session, this.sessionId, now);
    if (this.queue.length === 0) return;
    const events = this.queue;
    this.queue = [];
    try {
      this.deps.send({ visitorId: this.visitorId, sessionId: this.sessionId, events });
    } catch {
      // Descartado de propósito: sem retry, sem fila em memória crescendo.
    }
  }

  private entryContext(): Partial<SiteEventPayload> {
    try {
      const params = new URLSearchParams(this.deps.search());
      return {
        referrer: this.deps.referrer() || undefined,
        utmSource: params.get("utm_source") ?? undefined,
        utmMedium: params.get("utm_medium") ?? undefined,
        utmCampaign: params.get("utm_campaign") ?? undefined,
      };
    } catch {
      return {};
    }
  }

  /** Tira as chaves `undefined` para o JSON do lote ficar pequeno. */
  private compact(event: SiteEventPayload): SiteEventPayload {
    return Object.fromEntries(
      Object.entries(event).filter(([, value]) => value !== undefined),
    ) as SiteEventPayload;
  }

  private iso(ms: number): string {
    return new Date(ms).toISOString();
  }
}

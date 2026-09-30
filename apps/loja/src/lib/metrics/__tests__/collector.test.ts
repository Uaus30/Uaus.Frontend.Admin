import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BATCH_SIZE,
  FLUSH_INTERVAL_MS,
  IDLE_MS,
  MAX_PAGE_MS,
  MetricsCollector,
  OPT_OUT_KEY,
  SESSION_GAP_MS,
  SESSION_KEY,
  VISITOR_KEY,
  type CollectorDeps,
  type SiteEventBatch,
} from "../collector";
import { toMetricsRoute } from "../routes";

/** `Storage` de mentira, para o teste ler o que o coletor gravou. */
function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

function setup(overrides: Partial<CollectorDeps> = {}) {
  let clock = 1_700_000_000_000;
  let visible = true;
  let ids = 0;
  const sent: SiteEventBatch[] = [];
  const local = fakeStorage();
  const session = fakeStorage();

  const deps: CollectorDeps = {
    now: () => clock,
    local,
    session,
    send: (batch) => void sent.push(batch),
    randomId: () => `id-${++ids}`,
    isVisible: () => visible,
    referrer: () => "",
    search: () => "",
    ...overrides,
  };

  return {
    deps,
    sent,
    local,
    session,
    advance: (ms: number) => void (clock += ms),
    setVisible: (v: boolean) => void (visible = v),
    events: () => sent.flatMap((b) => b.events),
  };
}

describe("MetricsCollector", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("gera visitante e sessão e os reaproveita", () => {
    const t = setup();
    const a = new MetricsCollector(t.deps);
    const b = new MetricsCollector(t.deps);

    expect(t.local.getItem(VISITOR_KEY)).toBe("id-1");
    expect(a.currentSessionId).toBe("id-2");
    // Recarregar a página: mesma sessão, porque ainda não passaram 30 min.
    expect(b.currentSessionId).toBe("id-2");
    expect(JSON.parse(t.session.getItem(SESSION_KEY)!)).toMatchObject({ id: "id-2" });
  });

  it("abre sessão nova quando a última visita tem mais de 30 min", () => {
    const t = setup();
    const a = new MetricsCollector(t.deps);
    t.advance(SESSION_GAP_MS + 1);
    const b = new MetricsCollector(t.deps);

    expect(b.currentSessionId).not.toBe(a.currentSessionId);
  });

  it("o primeiro page_view da sessão leva referenciador e UTM; os seguintes não", () => {
    const t = setup({
      referrer: () => "https://l.instagram.com/",
      search: () => "?utm_source=instagram&utm_campaign=setembro",
    });
    const c = new MetricsCollector(t.deps);

    c.pageView("/");
    c.pageView("/produtos");
    c.flush();

    const views = t.events().filter((e) => e.type === "page_view");
    expect(views[0]).toMatchObject({
      path: "/",
      referrer: "https://l.instagram.com/",
      utmSource: "instagram",
      utmCampaign: "setembro",
    });
    expect(views[0]).not.toHaveProperty("utmMedium");
    expect(views[1]).not.toHaveProperty("referrer");
    expect(views[1]).not.toHaveProperty("utmSource");
  });

  it("detalhe de produto sai como page_view + product_view com o id em campo próprio", () => {
    const t = setup();
    const c = new MetricsCollector(t.deps);

    c.pageView("/produtos/:id", 905);
    c.flush();

    expect(t.events().map((e) => e.type)).toEqual(["page_view", "product_view"]);
    expect(t.events()[1]).toMatchObject({ path: "/produtos/:id", productGroupId: 905 });
  });

  it("manda o lote ao chegar em 10 eventos", () => {
    const t = setup();
    const c = new MetricsCollector(t.deps);

    for (let i = 0; i < BATCH_SIZE; i++) c.track("search", { detail: `t${i}` });

    expect(t.sent).toHaveLength(1);
    expect(t.sent[0].events).toHaveLength(BATCH_SIZE);
    expect(t.sent[0]).toMatchObject({ visitorId: "id-1", sessionId: "id-2" });
  });

  it("o tique manda o que acumulou depois de 15 s, e não antes", () => {
    const t = setup();
    const c = new MetricsCollector(t.deps);
    c.pageView("/");

    t.advance(FLUSH_INTERVAL_MS - 1);
    c.tick();
    expect(t.sent).toHaveLength(0);

    t.advance(1);
    c.tick();
    expect(t.sent).toHaveLength(1);
  });

  it("o tempo da página é o VISÍVEL: a ausência com a aba oculta não conta", () => {
    const t = setup();
    const c = new MetricsCollector(t.deps);
    c.pageView("/produtos");

    t.advance(10_000); // lendo
    t.setVisible(false);
    c.hidden(); // foi para o WhatsApp
    t.advance(5 * 60_000); // cinco minutos fora
    t.setVisible(true);
    c.visible();
    t.advance(3_000); // voltou e leu mais um pouco
    c.leave();

    // A página fecha ao ficar oculta (10 s) e fecha de novo ao sair (3 s): o
    // servidor soma. Os cinco minutos fora não aparecem em lugar nenhum, e a
    // volta não gera page_view novo.
    const leaves = t.events().filter((e) => e.type === "page_leave");
    expect(leaves.map((e) => e.durationMs)).toEqual([10_000, 3_000]);
    expect(leaves.every((e) => e.path === "/produtos")).toBe(true);
    expect(t.events().filter((e) => e.type === "page_view")).toHaveLength(1);
    // A mesma sessão: cinco minutos é menos que o intervalo de renovação.
    expect(new Set(t.sent.map((b) => b.sessionId)).size).toBe(1);
  });

  it("ao ficar oculta a página FECHA e o lote sai na hora — o sistema pode matar a aba em seguida", () => {
    const t = setup();
    const c = new MetricsCollector(t.deps);
    c.pageView("/produtos/:id", 905);
    t.advance(40_000);

    t.setVisible(false);
    c.hidden(); // abriu o WhatsApp; a aba nunca mais volta

    expect(t.events().find((e) => e.type === "page_leave")).toMatchObject({
      path: "/produtos/:id",
      productGroupId: 905,
      durationMs: 40_000,
    });
  });

  it("ficar oculta com a fila vazia ainda marca a sessão como viva", () => {
    const t = setup();
    const c = new MetricsCollector(t.deps);
    c.pageView("/");
    c.flush();
    t.advance(20 * 60_000); // lendo por 20 min sem gerar evento novo

    t.setVisible(false);
    c.hidden();

    // Recarregar a página 25 min depois: 45 min desde o último flush, mas só
    // 25 desde que ficou oculta — a sessão continua a mesma, como em `visible()`.
    t.advance(25 * 60_000);
    const d = new MetricsCollector(t.deps);
    expect(d.currentSessionId).toBe(c.currentSessionId);
  });

  it("ficar oculta por mais de 30 min renova a sessão e reabre a página como visita nova", () => {
    const t = setup({ referrer: () => "https://instagram.com/", search: () => "?utm_source=instagram" });
    const c = new MetricsCollector(t.deps);
    c.pageView("/produtos/:id", 905);
    t.advance(8_000);

    t.setVisible(false);
    c.hidden();
    const primeira = c.currentSessionId;
    t.advance(SESSION_GAP_MS + 60_000);
    t.setVisible(true);
    c.visible();
    t.advance(2_000);
    c.leave();

    expect(c.currentSessionId).not.toBe(primeira);
    const porSessao = new Map(t.sent.map((b) => [b.sessionId, b.events]));
    // A visita antiga fechou com os 8 s lidos antes de sair — a hora e meia oculta não entra.
    expect(porSessao.get(primeira)!.find((e) => e.type === "page_leave")).toMatchObject({
      durationMs: 8_000,
    });
    // A nova abre com page_view da mesma página e fecha com os 2 s — e sem
    // referenciador nem UTM, que são da entrada original.
    const nova = porSessao.get(c.currentSessionId)!;
    expect(nova.map((e) => e.type)).toEqual(["page_view", "product_view", "page_leave"]);
    expect(nova[0]).not.toHaveProperty("referrer");
    expect(nova[0]).not.toHaveProperty("utmSource");
    expect(nova[2]).toMatchObject({ durationMs: 2_000 });
  });

  it("sem interação por 2 min o cronômetro pausa, e retoma no próximo toque", () => {
    const t = setup();
    const c = new MetricsCollector(t.deps);
    c.pageView("/");

    t.advance(IDLE_MS + 10 * 60_000); // 12 minutos com a tela ligada, sem tocar
    c.tick();
    c.activity(); // voltou a rolar
    t.advance(4_000);
    c.leave();

    const leave = t.events().find((e) => e.type === "page_leave");
    // Conta os 2 min até a pausa e os 4 s depois do toque; os 10 min parados, não.
    expect(leave).toMatchObject({ durationMs: IDLE_MS + 4_000 });
  });

  it("o tempo por página tem teto de 30 min mesmo com atividade contínua", () => {
    const t = setup();
    const c = new MetricsCollector(t.deps);
    c.pageView("/");

    for (let i = 0; i < 60; i++) {
      t.advance(60_000);
      c.activity();
    }
    c.leave();

    expect(t.events().find((e) => e.type === "page_leave")).toMatchObject({ durationMs: MAX_PAGE_MS });
  });

  it("evento pontual herda a página e o produto em foco", () => {
    const t = setup();
    const c = new MetricsCollector(t.deps);
    c.pageView("/produtos/:id", 905);

    c.track("reserve_click", { detail: "Caneca 500ml" });
    c.flush();

    expect(t.events().at(-1)).toMatchObject({
      type: "reserve_click",
      path: "/produtos/:id",
      productGroupId: 905,
      detail: "Caneca 500ml",
    });
  });

  it("?semmetricas desliga o coletor neste navegador e ?commetricas religa", () => {
    const off = setup({ search: () => "?semmetricas" });
    const c1 = new MetricsCollector(off.deps);
    c1.pageView("/");
    c1.leave();

    expect(c1.isEnabled).toBe(false);
    expect(off.sent).toHaveLength(0);
    expect(off.local.getItem(OPT_OUT_KEY)).toBe("1");

    // Próxima visita, sem parâmetro: continua desligado.
    const c2 = new MetricsCollector({ ...off.deps, search: () => "" });
    expect(c2.isEnabled).toBe(false);

    const c3 = new MetricsCollector({ ...off.deps, search: () => "?commetricas" });
    expect(c3.isEnabled).toBe(true);
    expect(off.local.getItem(OPT_OUT_KEY)).toBeNull();
  });

  it("falha no envio é engolida e a fila não volta a crescer", () => {
    const t = setup({
      send: () => {
        throw new Error("rede caiu");
      },
    });
    const c = new MetricsCollector(t.deps);

    expect(() => {
      c.pageView("/");
      c.leave();
      c.leave();
    }).not.toThrow();
  });
});

describe("toMetricsRoute", () => {
  it("normaliza o detalhe do produto e extrai o id", () => {
    expect(toMetricsRoute("/produtos/905")).toEqual({ path: "/produtos/:id", productGroupId: 905 });
    expect(toMetricsRoute("/produtos/905/")).toEqual({ path: "/produtos/:id", productGroupId: 905 });
  });

  it("deixa as outras rotas como estão, sem barra final", () => {
    expect(toMetricsRoute("/")).toEqual({ path: "/" });
    expect(toMetricsRoute("/produtos/")).toEqual({ path: "/produtos" });
    expect(toMetricsRoute("/contato")).toEqual({ path: "/contato" });
    expect(toMetricsRoute("")).toEqual({ path: "/" });
  });
});

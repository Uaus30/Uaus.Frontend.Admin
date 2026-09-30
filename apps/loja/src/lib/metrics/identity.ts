/**
 * Quem é o visitante e qual é a visita — a parte do coletor que fala com o
 * armazenamento do navegador. Separada do `collector.ts` para cada arquivo
 * caber na cabeça (e nas 300 linhas do repositório).
 */

/** Mesmo contrato do `Storage` do DOM, reduzido ao que se usa. */
export type CollectorStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const VISITOR_KEY = "uaus-site-visitor";
export const SESSION_KEY = "uaus-site-session";
export const OPT_OUT_KEY = "uaus-site-metrics-off";

/** `?semmetricas` desliga o coletor neste navegador; `?commetricas` religa. */
export const OPT_OUT_PARAM = "semmetricas";
export const OPT_IN_PARAM = "commetricas";

/** Página oculta por mais que isto ao voltar = visita nova. */
export const SESSION_GAP_MS = 30 * 60_000;

interface StoredSession {
  id: string;
  lastSeen: number;
}

/**
 * Lê e grava a marca de desligamento. `?semmetricas` liga a marca;
 * `?commetricas` apaga. Sem parâmetro, vale o que está gravado. É como o dono e
 * a equipe evitam sujar os primeiros dias com os próprios testes.
 */
export function resolveOptOut(local: CollectorStorage, search: string): boolean {
  try {
    const params = new URLSearchParams(search);
    if (params.has(OPT_OUT_PARAM)) {
      local.setItem(OPT_OUT_KEY, "1");
      return true;
    }
    if (params.has(OPT_IN_PARAM)) {
      local.removeItem(OPT_OUT_KEY);
      return false;
    }
    return local.getItem(OPT_OUT_KEY) === "1";
  } catch {
    // Armazenamento bloqueado (modo privado estrito): melhor coletar sem
    // memória do que quebrar a página.
    return false;
  }
}

/** O UUID anônimo do navegador; nasce na primeira visita e fica. */
export function loadVisitor(local: CollectorStorage, randomId: () => string): string {
  try {
    const existing = local.getItem(VISITOR_KEY);
    if (existing) return existing;
    const created = randomId();
    local.setItem(VISITOR_KEY, created);
    return created;
  } catch {
    return randomId();
  }
}

/**
 * A sessão sobrevive a recarregar a página (`sessionStorage`), mas não a 30
 * minutos de ausência: quem volta depois disso está começando outra visita.
 *
 * `resumed` diz se a sessão veio do armazenamento — nesse caso o `page_view`
 * da recarga não é a entrada da visita e não leva referenciador nem UTM.
 */
export function loadSession(
  session: CollectorStorage,
  now: number,
  randomId: () => string,
): { id: string; resumed: boolean } {
  try {
    const raw = session.getItem(SESSION_KEY);
    if (raw) {
      const stored = JSON.parse(raw) as Partial<StoredSession>;
      if (typeof stored.id === "string" && typeof stored.lastSeen === "number") {
        if (now - stored.lastSeen <= SESSION_GAP_MS) {
          touchSession(session, stored.id, now);
          return { id: stored.id, resumed: true };
        }
      }
    }
  } catch {
    // cai no id novo
  }
  const created = randomId();
  touchSession(session, created, now);
  return { id: created, resumed: false };
}

/** Marca a sessão como vista agora. Sem memória de sessão, o pior caso é uma sessão a mais no relatório. */
export function touchSession(session: CollectorStorage, id: string, now: number) {
  try {
    const stored: StoredSession = { id, lastSeen: now };
    session.setItem(SESSION_KEY, JSON.stringify(stored));
  } catch {
    // ignorado
  }
}

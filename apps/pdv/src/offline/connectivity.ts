import { checkHealth } from "@workspace/api-client-react";

/**
 * Detecção de conexão com a API.
 *
 * `navigator.onLine` só diz que existe uma interface de rede ativa — ele continua
 * `true` com o roteador ligado e a internet caída, que é exatamente o cenário da
 * loja. Por isso a fonte da verdade é uma sondagem no `/Health` da API; o
 * `navigator.onLine` serve apenas como atalho para o caso trivial (cabo
 * arrancado) e como gatilho para sondar na hora.
 */

/** Intervalo entre sondagens quando a API está respondendo. */
const ONLINE_PROBE_INTERVAL_MS = 15_000;

/** Intervalo entre sondagens quando a API está fora — mais curto, para voltar rápido. */
const OFFLINE_PROBE_INTERVAL_MS = 5_000;

/** Sonda a API uma vez. */
export async function probeApi(): Promise<boolean> {
  // Sem interface de rede não há o que sondar; evita um fetch que só vai falhar.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return false;

  try {
    return await checkHealth();
  } catch {
    return false;
  }
}

/** Recebe o novo estado a cada mudança. */
export type ConnectivityListener = (online: boolean) => void;

/**
 * Começa a monitorar a conexão, avisando só quando o estado **muda**.
 *
 * O intervalo se adapta: com a API fora, sonda mais rápido para o operador voltar
 * a vender online o quanto antes. Os eventos `online`/`offline` do navegador
 * disparam uma sondagem imediata em vez de definir o estado direto — o navegador
 * dizer "online" não significa que a API respondeu.
 *
 * @param onChange Chamado a cada mudança de estado, e uma vez na primeira sondagem.
 * @returns Função que encerra o monitoramento.
 */
export function watchConnectivity(onChange: ConnectivityListener): () => void {
  let stopped = false;
  let online: boolean | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const scheduleNext = () => {
    if (stopped) return;
    timer = setTimeout(probe, online ? ONLINE_PROBE_INTERVAL_MS : OFFLINE_PROBE_INTERVAL_MS);
  };

  const probe = async () => {
    if (stopped) return;

    const result = await probeApi();
    if (stopped) return;

    if (result !== online) {
      online = result;
      onChange(result);
    }

    scheduleNext();
  };

  /** Um evento do navegador é motivo para sondar já, não para confiar. */
  const probeNow = () => {
    if (timer) clearTimeout(timer);
    void probe();
  };

  if (typeof window !== "undefined") {
    window.addEventListener("online", probeNow);
    window.addEventListener("offline", probeNow);
  }

  void probe();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", probeNow);
      window.removeEventListener("offline", probeNow);
    }
  };
}

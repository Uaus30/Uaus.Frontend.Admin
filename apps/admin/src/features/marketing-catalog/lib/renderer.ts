import type { PieceKind } from "../template/geometry";
import type { PieceData } from "../types";
import type { RenderedPixels } from "./rasterize";
import type { RenderJob, RenderRequest, RenderResponse } from "./render.worker";

/**
 * A porta do desenho: manda a peça para o worker e devolve os pixels.
 *
 * **O worker é o caminho normal; a thread principal é a rede de segurança.** Se
 * o worker não sobe (navegador antigo, sem worker de módulo) ou falha no meio,
 * a mesma peça é desenhada aqui, pelo mesmo código (`rasterize.ts`). A tela
 * trava durante o desenho, como travava antes do worker — mas o arquivo sai.
 * Devolver só a mensagem de erro deixaria o dono sem a peça por um problema
 * que não é dele.
 */

interface PendingJob {
  resolve: (pixels: RenderedPixels | undefined) => void;
  reject: (error: Error) => void;
}

/** `undefined` = ainda não tentou subir; `null` = não tem ou morreu. */
let worker: Worker | null | undefined;
let lastId = 0;
const pending = new Map<number, PendingJob>();

/** Desiste do worker e devolve o erro a quem estava esperando por ele. */
function abandonWorker(reason: string): void {
  worker?.terminate();
  worker = null;
  // Fica registrado no console: daqui em diante o desenho é na thread
  // principal, e sem o aviso ninguém saberia por que a tela voltou a travar.
  console.warn(`Catálogo: ${reason} O desenho passa para a thread principal.`);

  const jobs = [...pending.values()];
  pending.clear();
  for (const job of jobs) job.reject(new Error(reason));
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  if (typeof Worker === "undefined") {
    worker = null;
    return worker;
  }

  try {
    const created = new Worker(new URL("./render.worker.ts", import.meta.url), { type: "module" });

    created.onmessage = (event: MessageEvent<RenderResponse>) => {
      const response = event.data;
      const job = pending.get(response.id);
      if (!job) return;

      pending.delete(response.id);
      if (response.ok) job.resolve(response.pixels);
      else job.reject(new Error(response.message));
    };
    // `error` sem resposta é o worker que não carregou ou quebrou fora de um
    // pedido: ninguém mais vai responder, então não adianta esperar.
    created.onerror = () => abandonWorker("O worker de desenho parou.");
    created.onmessageerror = () => abandonWorker("O worker de desenho devolveu uma resposta ilegível.");

    worker = created;
  } catch {
    worker = null;
  }

  return worker;
}

function ask(target: Worker, job: RenderJob): Promise<RenderedPixels | undefined> {
  return new Promise((resolve, reject) => {
    const id = ++lastId;
    pending.set(id, { resolve, reject });
    target.postMessage({ ...job, id } satisfies RenderRequest);
  });
}

/** O mesmo desenho, na thread principal. */
async function renderHere(kind: PieceKind, data: PieceData): Promise<RenderedPixels> {
  const { rasterize } = await import("./rasterize");
  return rasterize(kind, data);
}

/** Desenha uma peça (ou uma página do catálogo) e devolve os pixels. */
export async function renderPiece(kind: PieceKind, data: PieceData): Promise<RenderedPixels> {
  const target = getWorker();

  if (target) {
    try {
      const pixels = await ask(target, { kind: "render", piece: kind, data });
      if (pixels) return pixels;
    } catch (error) {
      console.warn("Catálogo: o worker de desenho falhou nesta peça; desenhando na thread principal.", error);
    }
  }

  return renderHere(kind, data);
}

/**
 * Adianta o download do renderizador e das fontes enquanto a pessoa ainda lê a
 * tela.
 *
 * São ~1,1 MB comprimidos na primeira vez (depois o navegador guarda): baixados
 * só no toque em "Gerar", eles seriam espera com o botão já apertado. Falha
 * aqui é silenciosa de propósito — quem mostra o erro é a geração de verdade.
 */
export function preloadRenderer(): void {
  const target = getWorker();
  const warming = target
    ? ask(target, { kind: "warm" })
    : import("./rasterize").then((module) => module.warmUp());

  void warming.catch(() => undefined);
}

/** Só para os testes: volta ao estado de "ainda não tentou subir o worker". */
export function resetRendererForTests(): void {
  worker?.terminate();
  worker = undefined;
  pending.clear();
}

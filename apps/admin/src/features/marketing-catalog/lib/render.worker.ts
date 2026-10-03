import type { PieceKind } from "../template/geometry";
import type { PieceData } from "../types";
import { rasterize, warmUp, type RenderedPixels } from "./rasterize";

/**
 * O desenho da peça, fora da thread principal.
 *
 * O satori e o resvg ocupam o processador por 2 s num computador e por mais de
 * 5 s num celular. Na thread principal, a tela congelava durante esse tempo —
 * as "leves travadas" que o dono viu no celular em 03/10/2026 — e o catálogo
 * em PDF, que são quatro páginas, congelaria quatro vezes. Aqui o desenho corre
 * ao lado, e a tela segue respondendo e mostrando em que página está.
 */

/** O que se pede ao worker: aquecer (baixar bibliotecas e fontes) ou desenhar uma peça. */
export type RenderJob = { kind: "warm" } | { kind: "render"; piece: PieceKind; data: PieceData };

export type RenderRequest = RenderJob & { id: number };

export type RenderResponse =
  { id: number; ok: true; pixels?: RenderedPixels } | { id: number; ok: false; message: string };

/** O pedaço do escopo do worker que este arquivo usa (o tsconfig do admin só tem a lib do DOM). */
interface WorkerScope {
  onmessage: ((event: MessageEvent<RenderRequest>) => void) | null;
  postMessage(message: RenderResponse, transfer?: Transferable[]): void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = (event) => {
  const request = event.data;

  void (async () => {
    try {
      if (request.kind === "warm") {
        await warmUp();
        scope.postMessage({ id: request.id, ok: true });
        return;
      }

      const pixels = await rasterize(request.piece, request.data);
      // O buffer é TRANSFERIDO, não copiado: são 8 MB num banner e 10 MB numa página.
      scope.postMessage({ id: request.id, ok: true, pixels }, [pixels.data.buffer]);
    } catch (error) {
      scope.postMessage({
        id: request.id,
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  })();
};

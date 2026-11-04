import { createElement, type ReactElement } from "react";
import resvgWasmUrl from "@resvg/resvg-wasm/index_bg.wasm?url";
import { CatalogPiece } from "../template/CatalogPiece";
import { PIECE_SPECS, type PieceKind } from "../template/geometry";
import { SpotlightPiece } from "../template/SpotlightPiece";
import { SPOTLIGHT_SPECS } from "../template/spotlightGeometry";
import type { PieceData, SpotlightData, SpotlightFormat } from "../types";
import { loadCatalogFonts } from "./fonts";

/**
 * O que desenhar: uma peça do catálogo (ou uma página do PDF), ou um banner de
 * destaque (04/11/2026). Viaja pelo `postMessage` — por isso leva o NOME das
 * medidas, e não as medidas, que têm função.
 */
export type Drawing =
  | { template: "catalog"; piece: PieceKind; data: PieceData }
  | { template: "spotlight"; piece: SpotlightFormat; data: SpotlightData };

/** O molde e o tamanho de cada desenho. */
function prepare(drawing: Drawing): { element: ReactElement; width: number; height: number } {
  if (drawing.template === "spotlight") {
    const spec = SPOTLIGHT_SPECS[drawing.piece];
    return {
      element: createElement(SpotlightPiece, { spec, ...drawing.data }),
      width: spec.width,
      height: spec.height,
    };
  }

  const spec = PIECE_SPECS[drawing.piece];
  return {
    element: createElement(CatalogPiece, { spec, ...drawing.data }),
    width: spec.width,
    height: spec.height,
  };
}

/**
 * Do molde aos pixels.
 *
 * Dois passos, e nenhum deles usa o motor de desenho do aparelho: o satori
 * calcula o layout e transforma o molde em SVG (com o texto já convertido em
 * curvas, pela fonte embutida), e o resvg pinta o SVG em pixels. É por isso que
 * a peça sai IGUAL no Android, no iPhone e no computador — "fotografar a
 * página" (html2canvas e parentes) depende do navegador e falha no Safari.
 *
 * Este arquivo roda nos DOIS lados: dentro do worker (`render.worker.ts`), que
 * é o caminho normal, e na thread principal, quando o worker não sobe. Por isso
 * não toca em `document` nem em `window`: só `fetch` e WebAssembly.
 *
 * As duas bibliotecas entram por `import()` dinâmico: juntas passam de 2 MB, e
 * só quem gera uma peça paga por elas.
 */

/** A imagem pintada, em RGBA cru — o formato do `ImageData` do canvas. */
export interface RenderedPixels {
  data: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

let resvgReady: Promise<void> | null = null;

/** Inicializa o WebAssembly do resvg uma vez por sessão. */
async function ensureResvg(initWasm: (input: Promise<Response>) => Promise<void>): Promise<void> {
  resvgReady ??= initWasm(fetch(resvgWasmUrl));
  try {
    await resvgReady;
  } catch (error) {
    // Falhou por rede? A próxima tentativa precisa poder baixar de novo — sem
    // isto a promessa rejeitada ficaria guardada e o botão nunca mais funcionaria.
    resvgReady = null;
    throw error;
  }
}

/** As duas bibliotecas prontas para uso: baixadas e com o WebAssembly iniciado. */
async function loadLibraries() {
  const [{ default: satori }, { Resvg, initWasm }] = await Promise.all([
    import("satori"),
    import("@resvg/resvg-wasm"),
  ]);
  await ensureResvg(initWasm);
  return { satori, Resvg };
}

/** Baixa o que não depende da peça: as bibliotecas e as fontes. */
export async function warmUp(): Promise<void> {
  await Promise.all([loadLibraries(), loadCatalogFonts()]);
}

/**
 * Desenha uma peça e devolve os pixels.
 *
 * Pixels, e não PNG: o arquivo final é JPEG, e pedir o PNG ao resvg para
 * decodificá-lo logo depois custava 1,6 s dos 3 s da geração (medido em
 * 03/10/2026, num banner de 9 produtos). Os pixels vão direto para o canvas.
 */
export async function rasterize(drawing: Drawing): Promise<RenderedPixels> {
  const { element, width, height } = prepare(drawing);
  const [{ satori, Resvg }, fonts] = await Promise.all([loadLibraries(), loadCatalogFonts()]);

  const svg = await satori(element, { width, height, fonts });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: width },
    // O texto já chegou em curvas: procurar fonte do sistema seria trabalho à toa.
    font: { loadSystemFonts: false },
  });
  const image = resvg.render();
  try {
    // Cópia: os bytes originais moram na memória do WebAssembly, liberada abaixo.
    return { data: new Uint8ClampedArray(image.pixels), width: image.width, height: image.height };
  } finally {
    // Memória do WebAssembly não é coletada sozinha.
    image.free();
    resvg.free();
  }
}

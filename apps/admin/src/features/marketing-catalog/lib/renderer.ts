import type { ReactNode } from "react";
import resvgWasmUrl from "@resvg/resvg-wasm/index_bg.wasm?url";

/**
 * Do molde ao PNG, dentro do navegador.
 *
 * Dois passos, e nenhum deles usa o motor de desenho do aparelho: o satori
 * calcula o layout e transforma o molde em SVG (com o texto já convertido em
 * curvas, pela fonte embutida), e o resvg pinta o SVG em pixels. É por isso que
 * o banner sai IGUAL no Android, no iPhone e no computador — "fotografar a
 * página" (html2canvas e parentes) depende do navegador e falha no Safari.
 *
 * As duas bibliotecas entram por `import()` dinâmico: juntas passam de 2 MB, e
 * só quem abre a tela do catálogo paga por elas.
 */

/** Uma fonte entregue ao satori. Ele lê TTF, OTF e WOFF — WOFF2 não. */
export interface RenderFont {
  name: string;
  data: ArrayBuffer;
  weight: 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
  style: "normal";
}

export interface RenderSize {
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
async function loadRenderer() {
  const [{ default: satori }, { Resvg, initWasm }] = await Promise.all([
    import("satori"),
    import("@resvg/resvg-wasm"),
  ]);
  await ensureResvg(initWasm);
  return { satori, Resvg };
}

/**
 * Adianta o download do renderizador enquanto a pessoa ainda lê a tela.
 *
 * São ~1,1 MB comprimidos na primeira vez (depois o navegador guarda): baixados
 * só no toque em "Gerar", eles seriam espera com o botão já apertado. Falha
 * aqui é silenciosa de propósito — quem mostra o erro é a geração de verdade.
 */
export function preloadRenderer(): void {
  void loadRenderer().catch(() => undefined);
}

/** A imagem pintada, em RGBA cru — o formato do `ImageData` do canvas. */
export interface RenderedPixels extends RenderSize {
  data: Uint8ClampedArray<ArrayBuffer>;
}

/**
 * Desenha o molde e devolve os pixels no tamanho pedido.
 *
 * Pixels, e não PNG: o arquivo final é JPEG, e pedir o PNG ao resvg para
 * decodificá-lo logo depois custava 1,6 s dos 3 s da geração (medido em
 * 03/10/2026, num banner de 9 produtos). Os pixels vão direto para o canvas.
 */
export async function renderToPixels(
  element: ReactNode,
  size: RenderSize,
  fonts: RenderFont[],
): Promise<RenderedPixels> {
  const { satori, Resvg } = await loadRenderer();

  const svg = await satori(element, { ...size, fonts });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size.width },
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

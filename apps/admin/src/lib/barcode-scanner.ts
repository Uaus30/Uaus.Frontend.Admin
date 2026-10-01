/**
 * Leitura de código de barras pela câmera — o motor, sem tela.
 *
 * Usado pela busca da tela de Etiquetas (a lista montada olhando a prateleira)
 * e pela listagem de Produtos. Mora no `lib` do app, e não numa feature, porque
 * as duas consomem o mesmo leitor (CLAUDE.md, seção 6).
 *
 * **Dois leitores, uma interface.** O Chrome do Android traz o `BarcodeDetector`
 * nativo; o Safari do iPhone e o Chrome de computador, não. Sem o nativo entra o
 * pacote `barcode-detector`, que oferece a MESMA interface sobre o ZXing em
 * WebAssembly. Ele só é baixado quando a câmera abre sem leitor nativo — quem
 * nunca abre a câmera não paga o 1 MB do `.wasm`.
 *
 * **O `.wasm` sai do nosso próprio build**, não do CDN que o pacote usa por
 * padrão (jsDelivr): é a mesma decisão das barras impressas (`barcode-svg.ts`,
 * jsbarcode local) — a loja não fica refém de um terceiro para bipar.
 */

/** Um código encontrado na imagem. */
export interface DetectedBarcode {
  rawValue: string;
  format: string;
}

/** O que a tela precisa de um leitor: achar códigos num quadro do vídeo. */
export interface BarcodeReader {
  detect(source: HTMLVideoElement | HTMLCanvasElement): Promise<DetectedBarcode[]>;
}

/** Recorte do quadro da câmera que vai para o leitor. */
export interface ScanRegion {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/**
 * A faixa do quadro em que o código é procurado: a largura inteira e a metade
 * do meio da altura, na resolução ORIGINAL.
 *
 * O dono achou a leitura lenta no primeiro teste (30/09/2026). Ler o quadro
 * inteiro custa caro no leitor em WebAssembly; a faixa tem metade dos pixels e
 * cobre a mira com folga, mesmo com o `object-cover` cortando as laterais do
 * vídeo. De quebra, a etiqueta da prateleira de cima ou de baixo fica fora.
 *
 * **Não reduz a imagem.** A primeira versão encolhia a faixa para 960 de
 * largura, e o código de uma embalagem a um palmo de distância ficou com barras
 * de 1 a 2 pixels: os números legíveis na tela, as barras ilegíveis para o
 * leitor — que lê as barras, não os números.
 */
export function scanRegion(videoWidth: number, videoHeight: number): ScanRegion | null {
  if (videoWidth <= 0 || videoHeight <= 0) return null;
  const sh = Math.round(videoHeight / 2);
  return { sx: 0, sy: Math.round((videoHeight - sh) / 2), sw: videoWidth, sh };
}

/** Zoom pedido à câmera, quando ela oferece. */
export const SCAN_ZOOM = 2;

type ScanTrackCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  zoom?: { min: number; max: number };
};

/**
 * Ajusta a câmera para ler código de perto, no que ela oferecer:
 *
 * - **foco contínuo** — muita câmera traseira abre focada no infinito e não
 *   refaz sozinha de perto;
 * - **zoom de {@link SCAN_ZOOM}×** — o código cresce na mira sem aproximar o
 *   celular. Aproximar é o que a pessoa faz quando a leitura não vem, e a menos
 *   de uns 10 cm a câmera não foca mais: o remédio piorava o problema.
 *
 * Cada ajuste é tentado à parte: câmera que recusa um continua com o outro, e
 * câmera que não oferece nenhum segue como abriu.
 */
export async function tuneCameraTrack(track: MediaStreamTrack | undefined): Promise<void> {
  if (!track || typeof track.getCapabilities !== "function") return;
  const capabilities = track.getCapabilities() as ScanTrackCapabilities;

  const attempts: MediaTrackConstraintSet[] = [];
  if (capabilities.focusMode?.includes("continuous")) {
    attempts.push({ focusMode: "continuous" } as MediaTrackConstraintSet);
  }
  if (capabilities.zoom && capabilities.zoom.max > 1) {
    const zoom = Math.max(capabilities.zoom.min, Math.min(SCAN_ZOOM, capabilities.zoom.max));
    attempts.push({ zoom } as MediaTrackConstraintSet);
  }

  for (const constraint of attempts) {
    try {
      await track.applyConstraints({ advanced: [constraint] });
    } catch {
      // Sem esse ajuste a leitura ainda funciona, só pede mais da pessoa.
    }
  }
}

/**
 * Simbologias procuradas. EAN-13 é o catálogo inteiro desde 21/09/2026; CODE128
 * fica porque etiqueta de gôndola anterior à padronização ainda está colada na
 * prateleira; EAN-8 e UPC são embalagens de fábrica. Restringir a lista deixa a
 * leitura mais rápida e evita "achar" código em texto da embalagem.
 */
export const SCAN_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] as const;

interface NativeBarcodeDetectorClass {
  new (options?: { formats?: string[] }): BarcodeReader;
  getSupportedFormats(): Promise<string[]>;
}

/**
 * Há câmera utilizável? Exige contexto seguro (HTTPS ou localhost): fora dele o
 * navegador nem oferece `getUserMedia`, e o botão da câmera só frustraria.
 */
export function canUseCamera(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

/** Cria o leitor: o nativo quando ele lê EAN-13, senão o ZXing local. */
export async function createBarcodeReader(): Promise<BarcodeReader> {
  const Native = (globalThis as { BarcodeDetector?: NativeBarcodeDetectorClass }).BarcodeDetector;
  if (Native) {
    try {
      // Há Android que expõe a classe sem o serviço do Google Play por trás:
      // a lista de formatos vem vazia e o nativo não lê nada.
      const supported = await Native.getSupportedFormats();
      if (supported.includes("ean_13")) {
        return new Native({ formats: SCAN_FORMATS.filter((format) => supported.includes(format)) });
      }
    } catch {
      // Cai no leitor próprio.
    }
  }

  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? wasmUrl : prefix + path),
    },
  });
  return new BarcodeDetector({ formats: [...SCAN_FORMATS] });
}

/** Tempo sem ver um código para ele valer de novo. */
export const SCAN_REPEAT_COOLDOWN_MS = 2500;

/** Filtro de repetição da leitura — ver {@link createScanGate}. */
export interface ScanGate {
  /**
   * Recebe TODOS os códigos de um quadro e devolve o que vale (no máximo um por
   * quadro), ou `null`.
   */
  pick(codes: string[], now: number): string | null;
  /** Renova o código ao fim do trabalho que ele disparou (a busca do produto). */
  touch(code: string, now: number): void;
}

/**
 * Filtro de repetição: a câmera vê o mesmo código várias vezes por segundo, e
 * cada leitura não pode virar uma etiqueta a mais na lista.
 *
 * Cada código aceito ganha um relógio PRÓPRIO, renovado a cada quadro em que
 * aparece: ele só vale de novo depois de ficar {@link SCAN_REPEAT_COOLDOWN_MS}
 * fora de vista. Para duas cópias, afasta-se a câmera e volta-se, ou edita-se a
 * quantidade na lista.
 *
 * Por que um relógio por código, e não só o do último: com duas etiquetas no
 * quadro o leitor alterna entre elas, e "último código" via A, B, A, B — cada
 * troca contava como código novo e somava uma cópia. E o `touch` existe porque
 * a leitura pausa enquanto a busca do produto roda: no 4G fraco ela passa dos
 * 2,5 s, e o mesmo código, ainda na frente da câmera, entraria de novo.
 */
export function createScanGate(cooldownMs = SCAN_REPEAT_COOLDOWN_MS): ScanGate {
  const lastSeen = new Map<string, number>();

  return {
    pick(codes, now) {
      let picked: string | null = null;
      for (const code of codes) {
        const seenAt = lastSeen.get(code);
        if (seenAt !== undefined && now - seenAt < cooldownMs) {
          lastSeen.set(code, now);
          continue;
        }
        if (picked === null) {
          picked = code;
          lastSeen.set(code, now);
        }
      }
      return picked;
    },
    touch(code, now) {
      lastSeen.set(code, now);
    },
  };
}

/** Mensagem em português para a falha ao abrir a câmera. */
export function describeCameraError(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "O acesso à câmera foi bloqueado. Libere a câmera nas permissões do site e tente de novo.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "Nenhuma câmera encontrada neste aparelho.";
    case "NotReadableError":
      return "A câmera está em uso por outro aplicativo. Feche-o e tente de novo.";
    default:
      return "Não foi possível abrir a câmera.";
  }
}

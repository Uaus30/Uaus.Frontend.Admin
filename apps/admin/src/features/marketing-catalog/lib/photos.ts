import type { RenderedPixels } from "./rasterize";

/**
 * Fotos e artes viram data URL antes de chegar ao molde.
 *
 * O molde não aponta para o bucket: o arquivo gerado carrega as imagens dentro
 * dele. E a foto do produto passa por um canvas no caminho, por três motivos:
 *
 * 1. **Formato.** O bucket tem JPEG, PNG e WebP, e a extensão mente (há `.jpg`
 *    que é WebP por dentro). O canvas devolve sempre um JPEG comum, que o
 *    satori e o resvg leem sem surpresa.
 * 2. **Tamanho.** Uma capa de 1600 px desenhada num card de 300 px só pesaria
 *    na geração.
 * 3. **Transparência.** PNG e WebP com fundo vazado sairiam com fundo preto no
 *    JPEG; o canvas é pintado de branco antes.
 */

/** Maior lado da foto dentro do banner. O card maior tem ~500 px. */
const PHOTO_MAX_SIDE = 640;

/**
 * Maior lado da foto do banner de destaque (04/11/2026): o card ocupa o painel
 * inteiro, e a foto é desenhada com até ~940 px — reduzida a 640 ela borraria.
 */
export const SPOTLIGHT_PHOTO_MAX_SIDE = 1080;

const JPEG_QUALITY = 0.9;

/** Reduz para caber em `maxSide`, sem nunca ampliar. */
export function fitWithin(width: number, height: number, maxSide: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= 0) return { width: 0, height: 0 };

  const ratio = Math.min(1, maxSide / longest);
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler a imagem."));
    reader.readAsDataURL(blob);
  });
}

function decode(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Foto em formato que o navegador não abre."));
    };
    image.src = url;
  });
}

/**
 * Guarda a promessa por URL e esquece a que falhou: uma queda de rede não pode
 * deixar a imagem marcada como "indisponível" pelo resto da sessão.
 */
function remember<T>(cache: Map<string, Promise<T>>, url: string, load: () => Promise<T>): Promise<T> {
  let pending = cache.get(url);
  if (!pending) {
    pending = load().catch((error: unknown) => {
      cache.delete(url);
      throw error;
    });
    cache.set(url, pending);
  }
  return pending;
}

const assetCache = new Map<string, Promise<string>>();

/** Uma arte do próprio app (cabeçalho, rodapé), sem recompressão. */
export function loadAssetAsDataUrl(url: string): Promise<string> {
  return remember(assetCache, url, async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Arte do catálogo indisponível (${response.status}).`);
    return blobToDataUrl(await response.blob());
  });
}

/** A capa pronta para o molde, com o tamanho que ela tem NO ARQUIVO. */
export interface LoadedPhoto {
  dataUrl: string;
  /** Largura e altura originais, antes da redução para o card. */
  width: number;
  height: number;
}

const photoCache = new Map<string, Promise<LoadedPhoto>>();

async function downloadPhoto(url: string, maxSide: number): Promise<LoadedPhoto> {
  // `no-store` é o que faz o CORS funcionar: o admin já mostrou esta mesma URL
  // num `<img>` comum, e o navegador guardou a resposta SEM o cabeçalho de
  // CORS. Lida do cache, ela seria recusada aqui mesmo com o bucket liberado.
  const response = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!response.ok) throw new Error(`Foto indisponível (${response.status}).`);

  const image = await decode(await response.blob());
  const size = fitWithin(image.naturalWidth, image.naturalHeight, maxSide);

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("O navegador não liberou o canvas para preparar a foto.");

  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(image, 0, 0, size.width, size.height);
  return {
    dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY),
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

/**
 * A capa de um produto, pronta para o molde. Guarda o resultado na sessão:
 * "sortear de novo" costuma trazer de volta produto que já apareceu.
 *
 * O tamanho original vem junto porque o catálogo em PDF recusa foto pequena
 * (ver `minPhotoSide` em `formats.ts`): o servidor já filtra pelo tamanho
 * gravado, mas imagem ainda não medida passa por lá, e aqui é a última rede. O
 * banner de destaque usa o mesmo número para avisar da foto pequena.
 *
 * @param maxSide Até onde reduzir. A mesma foto em dois tamanhos são duas
 *   entradas do cache: a do catálogo não pode servir ao destaque, e vice-versa.
 */
export function loadPhoto(url: string, maxSide = PHOTO_MAX_SIDE): Promise<LoadedPhoto> {
  return remember(photoCache, `${maxSide}|${url}`, () => downloadPhoto(url, maxSide));
}

/**
 * Os pixels da peça em JPEG: um quarto do peso do PNG para subir no 4G, e o
 * WhatsApp e o Instagram recomprimem a imagem de qualquer jeito.
 */
export async function pixelsToJpegBlob(pixels: RenderedPixels, quality: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("O navegador não liberou o canvas para fechar o banner.");
  context.putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível fechar o arquivo do banner."))),
      "image/jpeg",
      quality,
    );
  });
}

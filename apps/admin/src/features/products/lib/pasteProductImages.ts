import { optimizeImage } from "@/lib/imageOptimizer";
import type { LocalImage } from "../types";

/** Resultado da colagem, com o antes e o depois para o aviso de otimização. */
export type PastedImagesResult = {
  images: LocalImage[];
  /** Soma dos bytes originais das imagens coladas. */
  originalSize: number;
  /** Soma dos bytes depois da compressão. */
  optimizedSize: number;
  /** Ao menos uma imagem encolheu — só aí vale avisar o operador. */
  optimized: boolean;
};

/** Os arquivos de imagem de uma colagem (Ctrl+V), ignorando texto e o resto. */
export function collectPastedImageFiles(items: DataTransferItemList | undefined): File[] {
  if (!items) return [];

  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.indexOf("image") === -1) continue;

    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return files;
}

/**
 * Comprime as imagens coladas e devolve as prévias locais.
 *
 * A colagem é o caminho mais comum de foto no cadastro — o operador copia do
 * site do fornecedor e cola. Vem em PNG de vários MB, e sem a compressão o
 * upload de um produto sozinho passava do que a hospedagem aceita.
 *
 * O nome carimba o instante só para os arquivos de uma mesma colagem não
 * colidirem; não é data de calendário, então `toISOString` aqui é inofensivo
 * (ver armadilha 2 do CLAUDE.md, que vale para o dia, não para o carimbo).
 */
export async function optimizePastedImages(files: File[]): Promise<PastedImagesResult> {
  const images: LocalImage[] = [];
  let originalSize = 0;
  let optimizedSize = 0;
  let optimized = false;

  for (let idx = 0; idx < files.length; idx++) {
    const file = files[idx];
    const extension = file.type.split("/")[1] || "png";
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `imagem-colada-${dateStr}-${idx + 1}`;
    const renamedFile = new File([file], `${name}.${extension}`, { type: file.type });

    const result = await optimizeImage(renamedFile);
    originalSize += result.originalSize;
    optimizedSize += result.optimizedSize;
    if (result.optimized) optimized = true;

    images.push({ name, url: URL.createObjectURL(result.file), file: result.file });
  }

  return { images, originalSize, optimizedSize, optimized };
}

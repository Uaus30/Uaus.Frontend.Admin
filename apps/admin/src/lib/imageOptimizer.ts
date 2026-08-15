/**
 * Opções de configuração para o otimizador de imagem.
 */
export interface ImageOptimizerOptions {
  /** Largura máxima da imagem em pixels. Padrão: 1600 */
  maxWidth?: number;
  /** Altura máxima da imagem em pixels. Padrão: 1600 */
  maxHeight?: number;
  /** Qualidade de compressão entre 0.0 e 1.0. Se não informado, será calculada dinamicamente. */
  quality?: number;
  /** Tamanho mínimo do arquivo em bytes para aplicar a compressão. Padrão: 204800 (200 KB) */
  minSizeToCompress?: number;
}

/**
 * Resultado da operação de otimização de imagem.
 */
export interface ImageOptimizerResult {
  /** O arquivo File resultante (otimizado ou original caso pulado) */
  file: File;
  /** Tamanho original do arquivo em bytes */
  originalSize: number;
  /** Tamanho otimizado do arquivo em bytes */
  optimizedSize: number;
  /** Indica se a imagem foi efetivamente otimizada/modificada */
  optimized: boolean;
}

/**
 * Obtém a qualidade de compressão recomendada com base no tamanho do arquivo original.
 * Ajusta dinamicamente a qualidade para obter a melhor relação peso/visual.
 *
 * @param sizeBytes Tamanho original do arquivo em bytes.
 * @returns Qualidade como número entre 0.0 e 1.0.
 */
function getDynamicQuality(sizeBytes: number): number {
  const fiveMega = 5 * 1024 * 1024;
  const twoMega = 2 * 1024 * 1024;

  if (sizeBytes > fiveMega) {
    return 0.70; // Compressão mais agressiva para imagens gigantes
  }
  if (sizeBytes > twoMega) {
    return 0.80; // Compressão média/balanceada
  }
  return 0.85; // Compressão leve para imagens menores
}

/**
 * Verifica se o navegador suporta canvas e as APIs necessárias.
 * Retorna falso em ambientes SSR ou de testes sem suporte completo a canvas.
 */
function isCanvasSupported(): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext && canvas.getContext("2d"));
  } catch {
    return false;
  }
}

/**
 * Otimiza um arquivo de imagem no frontend para reduzir o seu tamanho físico em bytes.
 * 
 * Se a imagem for muito grande ou pesada, ela será redimensionada respeitando as proporções
 * originais e comprimida com uma taxa de qualidade dinâmica ou pré-definida. PNG vira WebP
 * (preserva a transparência); os demais formatos viram JPEG.
 *
 * @param file O arquivo File original selecionado pelo usuário.
 * @param options Configurações adicionais de otimização (maxWidth, maxHeight, quality, minSizeToCompress).
 * @returns Uma Promise que resolve em um objeto contendo o File otimizado (ou original) e metadados de economia.
 */
export async function optimizeImage(
  file: File,
  options: ImageOptimizerOptions = {}
): Promise<ImageOptimizerResult> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    minSizeToCompress = 200 * 1024, // 200 KB
  } = options;

  const resultFallback: ImageOptimizerResult = {
    file,
    originalSize: file.size,
    optimizedSize: file.size,
    optimized: false,
  };

  // 1. Ignorar se não for imagem ou se for GIF animado (a renderização no canvas perderia a animação)
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return resultFallback;
  }

  // 2. Ignorar se o tamanho do arquivo for menor que o limite mínimo estabelecido
  if (file.size <= minSizeToCompress) {
    return resultFallback;
  }

  // 3. Fallback se não houver suporte nativo a Canvas (ambiente node/teste sem mock completo)
  if (!isCanvasSupported()) {
    return resultFallback;
  }

  try {
    return await new Promise<ImageOptimizerResult>((resolve) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let width = img.naturalWidth;
        let height = img.naturalHeight;

        // Calcular as novas dimensões proporcionalmente se exceder o limite
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx || typeof canvas.toBlob !== "function") {
          resolve(resultFallback);
          return;
        }

        // Desenhar a imagem no canvas aplicando o redimensionamento
        ctx.drawImage(img, 0, 0, width, height);

        // Obter qualidade (dinâmica ou parametrizada)
        const quality = options.quality ?? getDynamicQuality(file.size);
        
        const isPng = file.type === "image/png";
        const newType = isPng ? "image/webp" : "image/jpeg";

        // Converter para WebP (preserva transparência) ou JPEG
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(resultFallback);
              return;
            }

            // Normalizar o nome do arquivo
            let newName = file.name;
            if (isPng) {
              newName = file.name.replace(/\.[^/.]+$/, "") + ".webp";
            } else if (!file.type.includes("jpeg") && !file.type.includes("jpg")) {
              newName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
            }

            const optimizedFile = new File([blob], newName, {
              type: newType,
              lastModified: Date.now(),
            });

            // Se por acaso a compressão resultar em um arquivo maior (ex: PNG simples muito otimizado de fábrica)
            if (optimizedFile.size >= file.size) {
              resolve(resultFallback);
            } else {
              resolve({
                file: optimizedFile,
                originalSize: file.size,
                optimizedSize: optimizedFile.size,
                optimized: true,
              });
            }
          },
          newType,
          quality
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(resultFallback);
      };

      img.src = objectUrl;
    });
  } catch (error) {
    console.error("Erro ao otimizar imagem no frontend:", error);
    return resultFallback;
  }
}



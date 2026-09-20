import { ART_FORMAT } from "./promotionPrompt";
import type { PromotionArtFormat } from "./promotionPrompt";

/**
 * A regra da proporção das artes — pura, e por isso fora do componente.
 *
 * Mora aqui por dois motivos. O `react-refresh` recusa um arquivo de componente
 * que exporte função solta; e `jsdom` não decodifica imagem, então um teste que
 * dependesse do `onload` do `<img>` nunca terminaria — a parte testável é a
 * comparação das dimensões, e ela não precisa de navegador.
 *
 * **Aviso, nunca recusa** (§7.4 do plano): a loja pode ter uma arte 1:1 pronta e
 * querer usá-la assim mesmo, e travar o upload por causa de dez pixels seria o
 * sistema decidindo direção de arte.
 */

/** Tolerância da proporção: 4% cobre corte de um ou dois pixels sem deixar passar 1:1. */
const TOLERANCIA = 0.04;

export const ART_ASPECT: Record<PromotionArtFormat, number> = {
  feed: 4 / 5,
  story: 9 / 16,
};

/**
 * O aviso da proporção, a partir das dimensões.
 *
 * @param width Largura em pixels.
 * @param height Altura em pixels.
 * @param format Formato esperado do slot.
 */
export function describeAspectMismatch(
  width: number,
  height: number,
  format: PromotionArtFormat,
): string | undefined {
  if (!width || !height) return undefined;

  const medida = width / height;
  const esperada = ART_ASPECT[format];

  if (Math.abs(medida - esperada) / esperada <= TOLERANCIA) return undefined;

  return `A imagem está em ${width}×${height}; o esperado para ${ART_FORMAT[format].ratio} é algo como ${ART_FORMAT[format].size}.`;
}

/**
 * Mede a proporção do arquivo e devolve o aviso, ou `undefined` quando ela bate.
 *
 * Roda no navegador com `createObjectURL` porque é o único jeito de saber as
 * dimensões antes do upload — e é antes do upload que o aviso serve.
 */
export async function describeAspectWarning(
  file: File,
  format: PromotionArtFormat,
): Promise<string | undefined> {
  const url = URL.createObjectURL(file);

  try {
    const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("imagem ilegível"));
      img.src = url;
    });

    return describeAspectMismatch(width, height, format);
  } catch {
    // Arquivo que o navegador não consegue decodificar: o upload continua
    // possível, e quem recusa formato é o backend.
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * O limite de fotos por produto (04/10/2026, decisão do dono): a capa e mais
 * duas. É o que a tela de detalhe mostra (capa grande e duas menores embaixo) e
 * o mesmo teto do backend (`ProductGroupImage.MaxPerGroup`), que recusa a quarta
 * foto na galeria e na compra.
 *
 * Mora em `lib/` porque duas features gravam a galeria do produto — o cadastro
 * e a compra —, e `features/a` não importa de `features/b`.
 */
export const MAX_PRODUCT_IMAGES = 3;

/**
 * A lista dentro do limite, preservando a ordem: as primeiras ficam, e a
 * primeira continua sendo a capa.
 */
export function withinImageLimit<T>(images: readonly T[]): T[] {
  return images.slice(0, MAX_PRODUCT_IMAGES);
}

/** O aviso de quando fotos ficaram de fora — o mesmo texto nas duas telas. */
export function imageLimitMessage(leftOut: number): { title: string; description: string } {
  return {
    title: "Limite de 3 imagens",
    description:
      leftOut === 1
        ? "Cada produto tem no máximo 3 imagens: 1 imagem ficou de fora. Remova uma para trocar."
        : `Cada produto tem no máximo 3 imagens: ${leftOut} imagens ficaram de fora. Remova uma para trocar.`,
  };
}

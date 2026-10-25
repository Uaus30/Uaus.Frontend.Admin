/** Uma cor em RGB, de 0 a 255 por canal. */
export type Rgb = readonly [number, number, number];

/**
 * As cores da malha de polígonos do fundo, da esquerda para a direita: o laranja
 * da marca (`--primary`), o violeta de destaque (`--accent`) e um azul-céu que
 * fecha a faixa fria dos botões. Ficam em RGB, e não em variável CSS, porque o
 * canvas pinta com `rgba()` montado a cada traço.
 */
export const POLYGON_COLORS: readonly Rgb[] = [
  [249, 116, 21],
  [155, 106, 241],
  [56, 189, 248],
];

/**
 * A cor da malha numa posição horizontal: 0 é a borda esquerda, 1 a direita, e
 * no meio as cores de `POLYGON_COLORS` se misturam.
 *
 * Fora de 0..1 (o ponto que acabou de sair pela borda) vale a cor da borda. NaN
 * — largura zero no meio de um redimensionamento — vale a da esquerda: sem essa
 * guarda o NaN atravessaria `Math.min`/`Math.max` intacto e viraria um índice
 * NaN, ou seja, `undefined` e uma leitura que derruba o quadro.
 *
 * @param fraction A posição horizontal, de 0 a 1.
 * @returns A cor naquele ponto.
 */
export function polygonColorAt(fraction: number): Rgb {
  const valid = Number.isFinite(fraction) ? fraction : 0;
  const scaled = Math.min(Math.max(valid, 0), 0.999) * (POLYGON_COLORS.length - 1);
  const index = Math.floor(scaled);
  const t = scaled - index;
  const from = POLYGON_COLORS[index];
  const to = POLYGON_COLORS[index + 1] ?? from;
  return [
    Math.round(from[0] + (to[0] - from[0]) * t),
    Math.round(from[1] + (to[1] - from[1]) * t),
    Math.round(from[2] + (to[2] - from[2]) * t),
  ];
}

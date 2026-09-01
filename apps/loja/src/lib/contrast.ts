/**
 * Escolha da cor do texto sobre um fundo que o front não controla.
 *
 * A cor dos selos de produto vem do cadastro de etiquetas do admin — quem
 * escolhe é a lojista. Enquanto o texto foi fixo em branco, etiqueta clara
 * (amarelo, bege, verde-limão) saía ilegível na foto do produto, e não há como
 * o site pedir para ela escolher outra cor: ele calcula qual texto ler.
 */

/** Linearização de canal sRGB, como manda a definição de luminância da WCAG 2. */
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Canais 0–255 de `#RGB`, `#RRGGBB` ou `rgb(r, g, b)`; `null` no que não
 * reconhecer. O cadastro guarda hexadecimal, mas cor digitada à mão chega como
 * qualquer coisa — e cor inválida não pode derrubar a vitrine.
 */
export function parseColor(color: string): [number, number, number] | null {
  const value = color.trim();

  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);
  if (short) {
    return [
      Number.parseInt(short[1] + short[1], 16),
      Number.parseInt(short[2] + short[2], 16),
      Number.parseInt(short[3] + short[3], 16),
    ];
  }

  const long = /^#([0-9a-f]{6})$/i.exec(value);
  if (long) {
    const n = Number.parseInt(long[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(value);
  if (rgb) {
    const channels = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    if (channels.every((c) => c <= 255)) return channels as [number, number, number];
  }

  return null;
}

/** Luminância relativa (0 = preto, 1 = branco) da WCAG 2. */
export function relativeLuminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** Branco: o texto de selo quando o fundo é escuro o bastante. */
export const TEXT_ON_DARK = "#FFFFFF";

/** Quase-preto (o `--foreground` do tema) para fundo claro. */
export const TEXT_ON_LIGHT = "#0F1729";

/**
 * Ponto em que branco e preto empatam em contraste sobre o mesmo fundo.
 *
 * Contraste com branco é `1,05 / (L + 0,05)`; com preto, `(L + 0,05) / 0,05`.
 * Igualando os dois: `(L + 0,05)² = 0,0525`, ou seja `L ≈ 0,1791`. Abaixo
 * disso o branco ganha; acima, o texto escuro.
 */
const LUMINANCE_TIPPING_POINT = 0.1791;

/**
 * Cor de texto legível sobre `background`.
 *
 * Cor irreconhecível cai em branco, que é o comportamento que o site já tinha
 * — degradar para o estado anterior é melhor que não renderizar o selo.
 */
export function readableTextColor(background: string): string {
  const channels = parseColor(background);
  if (!channels) return TEXT_ON_DARK;
  return relativeLuminance(channels) > LUMINANCE_TIPPING_POINT ? TEXT_ON_LIGHT : TEXT_ON_DARK;
}

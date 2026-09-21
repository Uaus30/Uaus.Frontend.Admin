import JsBarcode from "jsbarcode";
import { resolveBarcodeFormat } from "@workspace/core";

/**
 * Desenho das barras como SVG, para a prévia do cadastro e para as duas
 * etiquetas impressas (80mm do produto e folha A4 de gôndola).
 *
 * Mora no `lib` do app, e não dentro de uma feature, porque `products` e
 * `gondola-labels` desenham as mesmas barras — e feature importando de feature é
 * o que o CLAUDE.md proíbe. A **regra** do código (verificador, validação,
 * simbologia) é outra coisa e vive em `@workspace/core`; aqui só sobra o que
 * toca o DOM.
 *
 * Não vai para `packages/ui` por peso: a jsbarcode só é dependência do admin, e
 * levá-la para lá a colocaria também no bundle do PDV e da loja, que não
 * desenham código de barras nenhum.
 */

/** Ajustes de desenho que mudam de uma etiqueta para outra. */
type BarcodeSvgOptions = {
  /** Largura do módulo (a barra mais fina), em px. */
  width?: number;
  /** Altura das barras, em px. */
  height?: number;
  /** Fonte do número impresso sob as barras. */
  font?: string;
  /** Distância entre as barras e o número, em px. */
  textMargin?: number;
};

/**
 * Gera o SVG do código de barras como string, com a jsbarcode **local** — nada
 * de CDN: a impressão precisa funcionar com a internet da loja fora do ar.
 *
 * Desenhar aqui, na janela do admin, e injetar o markup pronto no documento de
 * impressão evita o outro caminho, que era carregar a biblioteca dentro do
 * iframe e torcer para ela chegar antes do `print()`.
 *
 * @returns Markup do SVG, ou null quando o valor é vazio ou a lib recusa o código.
 */
export function buildBarcodeSvg(value: string, options: BarcodeSvgOptions = {}): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  try {
    JsBarcode(svg, trimmed, {
      format: resolveBarcodeFormat(trimmed),
      width: options.width ?? 1.8,
      height: options.height ?? 52,
      margin: 0,
      background: "transparent",
      lineColor: "#000000",
      displayValue: true,
      font: options.font ?? "Arial",
      fontSize: 14,
      textMargin: options.textMargin ?? 1,
    });
  } catch {
    // Código fora do alfabeto do formato: melhor etiqueta sem barras do que
    // derrubar a impressão do lote inteiro.
    return null;
  }

  return svg.outerHTML;
}

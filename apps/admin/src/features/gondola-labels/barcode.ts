import JsBarcode from "jsbarcode";
import { resolveBarcodeFormat } from "@/features/products/lib/barcode";

/**
 * Gera o SVG do código de barras como string, com a jsbarcode local — nada de
 * CDN: a impressão precisa funcionar offline.
 *
 * @returns Markup do SVG, ou null quando o valor é vazio ou a lib recusa o código.
 */
export function buildBarcodeSvg(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

  try {
    JsBarcode(svg, trimmed, {
      format: resolveBarcodeFormat(trimmed),
      width: 1.8,
      height: 52,
      margin: 0,
      background: "transparent",
      lineColor: "#000000",
      displayValue: true,
      font: "Arial",
      fontSize: 14,
      textMargin: 1,
    });
  } catch {
    // Código fora do alfabeto do formato: melhor etiqueta sem barras do que
    // derrubar a impressão do lote inteiro.
    return null;
  }

  return svg.outerHTML;
}

import JsBarcode from "jsbarcode";

/** Formatos que a etiqueta imprime; CODE128 é o coringa para códigos internos. */
export type BarcodeFormat = "EAN13" | "EAN8" | "CODE128";

/**
 * Confere o dígito verificador de um EAN-8/EAN-13 (pesos 3 e 1, da direita
 * para a esquerda). Comprimentos fora de 8/13 dígitos retornam falso.
 */
export function hasValidEanCheckDigit(digits: string): boolean {
  if (!/^\d{8}$|^\d{13}$/.test(digits)) return false;

  const numbers = digits.split("").map(Number);
  const check = numbers.pop() ?? 0;
  const sum = numbers.reverse().reduce((acc, digit, index) => acc + digit * (index % 2 === 0 ? 3 : 1), 0);

  return (10 - (sum % 10)) % 10 === check;
}

/**
 * Formato de barras para o valor: EAN fiel quando o dígito verificador fecha,
 * senão CODE128 — que aceita qualquer texto e evita o erro que a jsbarcode
 * lança para EAN com verificador errado.
 */
export function resolveBarcodeFormat(value: string): BarcodeFormat {
  if (value.length === 13 && hasValidEanCheckDigit(value)) return "EAN13";
  if (value.length === 8 && hasValidEanCheckDigit(value)) return "EAN8";
  return "CODE128";
}

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
      width: 1.6,
      height: 44,
      margin: 0,
      background: "transparent",
      lineColor: "#000000",
      displayValue: true,
      font: "Arial",
      fontSize: 13,
      textMargin: 1,
    });
  } catch {
    // Código fora do alfabeto do formato: melhor etiqueta sem barras do que
    // derrubar a impressão do lote inteiro.
    return null;
  }

  return svg.outerHTML;
}

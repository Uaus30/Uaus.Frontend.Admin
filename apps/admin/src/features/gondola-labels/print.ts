import { escapeHtml } from "@workspace/core";
import { printReceiptHtml } from "@workspace/receipt";
import { buildBarcodeSvg } from "./barcode";
import { getLabelTypeInfo, type PrintableLabel } from "./types";

/**
 * Folha A4 com as etiquetas em duas colunas (20 por página, 10 linhas × 2 colunas).
 * As medidas são absolutas em milímetros para o layout não depender do viewport
 * do iframe de impressão, e `print-color-adjust: exact` garante o fundo
 * amarelo/vermelho no papel.
 */
const SHEET_STYLES = `
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    width: 194mm;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 3mm 4mm;
  }
  .label {
    height: 24mm;
    border: 0.35mm solid #9a9a9a;
    border-radius: 2mm;
    padding: 1.5mm 3.5mm;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .label-name {
    font-family: "Arial Black", Arial, sans-serif;
    font-weight: 900;
    line-height: 1.05;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: -0.01em;
    max-height: 7.2mm;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .label-bottom {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 2mm;
  }
  .label-bottom.no-barcode {
    justify-content: center;
  }
  .label-barcode { display: flex; align-items: flex-end; }
  .label-barcode svg { height: 13.5mm; width: auto; max-width: 50mm; }
  .label-price {
    display: flex;
    align-items: baseline;
    gap: 0.8mm;
    white-space: nowrap;
    font-family: "Arial Black", Arial, sans-serif;
    font-weight: 900;
  }
  .label-currency { font-size: 13pt; font-weight: 900; }
  .label-value { font-size: 32pt; font-weight: 900; letter-spacing: -0.04em; line-height: 0.8; }
`;

/**
 * Retorna o tamanho da fonte (em pt) do nome do produto conforme o comprimento
 * do texto, garantindo destaque com fonte Arial Black em caixa alta para nomes
 * curtos/médios e redução suave para que nomes longos caibam sem corte nas duas
 * linhas disponíveis.
 */
export function getProductNameFontSizePt(name: string): number {
  const length = name.trim().length;
  if (length <= 20) return 11.5;
  if (length <= 34) return 9.5;
  if (length <= 48) return 8;
  return 7;
}

/** Formata o preço como na etiqueta: "1.234,56". O "R$" é um elemento menor à parte. */
export function formatLabelPrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Reexportado de @workspace/core, onde a implementação é única.
export { escapeHtml };

/**
 * Monta o documento A4 do lote. Cada item vira `quantity` células idênticas,
 * preenchendo a grade de duas colunas na ordem da lista.
 *
 * @param labels Etiquetas com os valores que saem no papel.
 * @param buildBarcode Injetável nos testes; o padrão gera SVG com a jsbarcode local.
 */
export function buildLabelSheetHtml(
  labels: PrintableLabel[],
  buildBarcode: (value: string) => string | null = buildBarcodeSvg,
): string {
  const cells = labels.flatMap((label) => {
    const info = getLabelTypeInfo(label.labelType);
    const barcodeSvg = label.barcode ? buildBarcode(label.barcode) : null;
    const hasBarcode = Boolean(label.barcode && barcodeSvg);
    const bottomClass = hasBarcode ? "label-bottom" : "label-bottom no-barcode";

    const fontSizePt = getProductNameFontSizePt(label.productName);

    const cell = [
      `<div class="label" style="background:${info.background};color:${info.foreground};">`,
      `<div class="label-name" style="font-size:${fontSizePt}pt;">${escapeHtml(label.productName)}</div>`,
      `<div class="${bottomClass}">`,
      hasBarcode ? `<div class="label-barcode">${barcodeSvg}</div>` : "",
      `<div class="label-price"><span class="label-currency">R$</span>` +
        `<span class="label-value">${formatLabelPrice(label.price)}</span></div>`,
      `</div>`,
      `</div>`,
    ].join("");

    return Array.from({ length: Math.max(1, label.quantity) }, () => cell);
  });

  return [
    "<!DOCTYPE html>",
    '<html lang="pt-BR">',
    "<head>",
    '<meta charset="utf-8" />',
    "<title>Etiquetas de Gôndola</title>",
    `<style>${SHEET_STYLES}</style>`,
    "</head>",
    "<body>",
    `<div class="sheet">${cells.join("")}</div>`,
    "</body>",
    "</html>",
  ].join("");
}

/**
 * Abre a caixa de impressão com a folha A4 do lote, reusando o motor de iframe
 * do pacote de cupom (cleanup por afterprint, sem pop-up).
 *
 * @returns Promise resolvida quando a impressão termina ou é cancelada.
 */
export function printLabelSheet(labels: PrintableLabel[]): Promise<void> {
  return printReceiptHtml(buildLabelSheetHtml(labels));
}

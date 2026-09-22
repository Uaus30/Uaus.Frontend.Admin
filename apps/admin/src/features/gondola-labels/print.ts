import { escapeHtml } from "@workspace/core";
import { printReceiptHtml } from "@workspace/receipt";
import { buildBarcodeSvg } from "@/lib/barcode-svg";
import { getLabelTypeInfo, type PrintableLabel } from "./types";

/**
 * Altura impressa do código de barras inteiro (barras + número).
 *
 * É **fixa para toda etiqueta da folha**, e o `preserveAspectRatio="none"` do
 * `buildLabelBarcodeSvg` é o que garante isso: no desenho padrão, um código que
 * bate no teto de largura encolhe proporcionalmente e perde altura junto — na
 * mesma folha saíam barras de 9.1mm, 7.3mm e 6.3mm, conforme o código e o
 * tamanho do preço ao lado. Agora o aperto é só horizontal.
 */
const LABEL_BARCODE_HEIGHT_MM = 12.6;

/**
 * Folha A4 com as etiquetas em duas colunas (20 por página, 10 linhas × 2 colunas).
 * As medidas são absolutas em milímetros para o layout não depender do viewport
 * do iframe de impressão, e `print-color-adjust: exact` garante o fundo
 * amarelo/vermelho no papel.
 *
 * O contorno da etiqueta é um retângulo de canto vivo: ele não é enfeite, é a
 * linha de corte. A folha sai da impressora e alguém recorta com tesoura, e
 * canto arredondado não dá para seguir — a mão corta reto e sobra rebarba de um
 * lado da curva.
 *
 * A linha de baixo alinha pelo **centro**: o preço fica na meia-altura das
 * barras, e não apoiado na mesma base. Com `flex-end`, o "R$ 1,75" descia até a
 * linha dos dígitos do código e a etiqueta ficava pesada embaixo.
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
    align-items: center;
    justify-content: space-between;
    gap: 2mm;
  }
  .label-bottom.no-barcode {
    justify-content: center;
  }
  /* Metade da etiqueta é o teto das barras: a outra metade é do preço, que é o
     que se lê de longe na gôndola. Código comprido (CODE128 de lote antigo)
     encolhe até caber nessa metade em vez de empurrar o preço.
     As barras também cedem espaço quando o preço é grande — preço cortado é
     etiqueta refeita, barra menor o leitor ainda bipa. O SVG tem viewBox, então
     encolher mantém a proporção em vez de espremer a barra. */
  .label-barcode {
    display: flex;
    align-items: center;
    min-width: 0;
    flex: 0 1 auto;
    max-width: 50%;
  }
  .label-barcode svg { height: ${LABEL_BARCODE_HEIGHT_MM}mm; width: auto; max-width: 100%; }
  .label-price {
    display: flex;
    flex: 0 0 auto;
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
 * Largura do módulo (a barra mais fina) das barras da etiqueta de gôndola.
 *
 * O número é absoluto, e não um múltiplo do padrão do `buildBarcodeSvg`, porque
 * o que importa é a **largura impressa** — e ela depende de três coisas ao mesmo
 * tempo: o módulo, o corpo do número e a altura de 13.5mm fixada no CSS. O SVG
 * escala pelo viewBox, então número maior deixa o desenho mais alto e, na mesma
 * altura, mais estreito. Mexeu em um, meça os três.
 *
 * Medido em 21/09/2026 na folha real, EAN-13: **42.2mm** de largura impressa,
 * barras de 9.1mm e número de 4.7mm (o desenho guardado antigo dava 39.3mm de
 * largura com barras de 10.5mm).
 *
 * A largura tem teto prático: com preço de cinco dígitos ("39,90"), barras de
 * 46.9mm estouravam a linha em 94.7mm numa caixa de 87.6mm e o papel saía com o
 * **preço** cortado. Daí o `flex: 0 0 auto` do preço e o `0 1 auto` das barras.
 */
export const LABEL_BARCODE_MODULE_WIDTH = 2.25;

/**
 * Altura das barras no desenho, em unidades do viewBox — o padrão da lib é 52.
 *
 * O que fixa a altura impressa é o {@link LABEL_BARCODE_HEIGHT_MM}; este número
 * é a **divisão** daquele espaço entre barra e número: 37 de barra para 24 de
 * número deixa a barra com 7.3mm e o número com 4.7mm. Subir aqui empurra o
 * número para baixo do mínimo legível na gôndola, que é o que se lê de perto.
 */
export const LABEL_BARCODE_BAR_HEIGHT = 37;

/**
 * Folga abaixo do número, em unidades do viewBox.
 *
 * A jsbarcode encosta a linha de base do texto na borda do SVG, que recorta o
 * resto: sem estes 2, a barriga do 8, do 9 e do 5 saía cortada no papel. Entra
 * na conta da altura — por isso o {@link LABEL_BARCODE_HEIGHT_MM} é 12.6 e não
 * 12.2, para a barra continuar com os mesmos 7.3mm.
 */
export const LABEL_BARCODE_BOTTOM_MARGIN = 2;

/**
 * Corpo do número sob as barras. Os 14 px do padrão ocupavam menos da metade da
 * largura do código e sobrava faixa branca dos dois lados; com 24 o número cobre
 * ~72% dela. Na gôndola isso é o que interessa — quem está diante da prateleira
 * confere o código com o olho, quem bipa é o caixa.
 *
 * O preço dos dígitos maiores são barras mais baixas (10.5mm → 9.1mm): a altura
 * total é fixa em 13.5mm, e os dois dividem o mesmo espaço.
 *
 * Só tem efeito com o desenho reto: no guardado a jsbarcode corta a fonte em
 * `width * 10` (ver `EAN.js`).
 */
export const LABEL_BARCODE_FONT_SIZE = 24;

/**
 * Desenha as barras da etiqueta de gôndola: largura própria e desenho **reto**
 * — sem as guardas compridas do EAN-13 e sem o primeiro dígito solto na
 * lateral, o mesmo formato que o CODE128 já imprimia.
 */
export function buildLabelBarcodeSvg(value: string): string | null {
  return buildBarcodeSvg(value, {
    width: LABEL_BARCODE_MODULE_WIDTH,
    height: LABEL_BARCODE_BAR_HEIGHT,
    fontSize: LABEL_BARCODE_FONT_SIZE,
    marginBottom: LABEL_BARCODE_BOTTOM_MARGIN,
    flat: true,
    stretch: true,
  });
}

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
  buildBarcode: (value: string) => string | null = buildLabelBarcodeSvg,
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

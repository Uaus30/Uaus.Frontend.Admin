import { escapeHtml, formatCurrency } from "@workspace/core";
import { buildBarcodeSvg } from "./barcode";

/**
 * Etiqueta de 80mm x 40mm do cadastro do produto: nome, barras e preço.
 *
 * Não confundir com as etiquetas de gôndola (`features/gondola-labels`), que
 * são a folha A4 com o preço grande para a prateleira. Esta é a que vai colada
 * no produto, e é ela que o caixa bipa.
 */

type BarcodeLabelParams = {
  /** Código já resolvido — use `buildDisplayBarcode` antes de chamar. */
  barcode: string;
  /** Nome impresso acima do código. */
  name: string;
  /** Preço impresso abaixo do código. */
  price: number;
};

const LABEL_STYLES = `
          @page { margin: 0; size: 80mm 40mm; }
          body {
            margin: 0;
            padding: 8px;
            width: 80mm;
            font-family: sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .name { font-size: 14px; font-weight: bold; text-align: center; margin-bottom: 4px; max-height: 32px; overflow: hidden; text-overflow: ellipsis; }
          .price { font-size: 18px; font-weight: bold; margin-top: 4px; }
          svg { max-width: 100%; height: auto; }`;

/**
 * Monta o documento da etiqueta, com o SVG das barras **já desenhado**.
 *
 * O desenho vem pronto de propósito: antes o documento carregava a jsbarcode de
 * um CDN (`cdn.jsdelivr.net`) e só chamava `print()` no `onload`. Com a internet
 * da loja fora do ar, o script não chegava, a etiqueta saía com nome e preço
 * **sem barras** — papel colado no produto que o caixa não consegue bipar — e
 * ninguém descobria antes de a etiqueta estar impressa.
 *
 * @param buildBarcode Injetável nos testes; o padrão desenha com a jsbarcode local.
 */
export function buildBarcodeLabelHtml(
  { barcode, name, price }: BarcodeLabelParams,
  buildBarcode: (value: string) => string | null = (value) =>
    buildBarcodeSvg(value, { width: 2, height: 40, font: "monospace", textMargin: 2 }),
): string {
  const barcodeSvg = buildBarcode(barcode) ?? "";
  const printedName = escapeHtml((name || "Produto").toUpperCase().substring(0, 30));

  return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Imprimir Etiqueta</title>
        <style>${LABEL_STYLES}
        </style>
      </head>
      <body>
        <div class="name">${printedName}</div>
        ${barcodeSvg}
        <div class="price">${formatCurrency(price || 0)}</div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.focus();
              window.print();
              window.parent.postMessage('printCompleted', '*');
            }, 100);
          };
        </script>
      </body>
      </html>
    `;
}

/**
 * Imprime a etiqueta de 80mm x 40mm num iframe fora da tela.
 *
 * O iframe existe para não levar a página inteira para a impressora: `print()`
 * na janela principal imprimiria o admin. O `postMessage` avisa o fim da
 * impressão para o iframe ser removido — sem isso cada impressão deixaria um
 * documento órfão no DOM.
 */
export function printBarcodeLabel(params: BarcodeLabelParams): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.width = "0px";
  iframe.style.height = "0px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) return;

  const handleMessage = (e: MessageEvent) => {
    if (e.data === "printCompleted") {
      window.removeEventListener("message", handleMessage);
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 100);
    }
  };
  window.addEventListener("message", handleMessage);

  iframeDoc.open();
  iframeDoc.write(buildBarcodeLabelHtml(params));
  iframeDoc.close();
}

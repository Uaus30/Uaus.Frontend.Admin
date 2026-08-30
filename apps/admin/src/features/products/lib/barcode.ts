import { formatCurrency } from "@workspace/core";

/**
 * Código de barras do produto: validação, prévia e impressão da etiqueta.
 *
 * Morava dentro da modal de edição. Saiu de lá quando a modal virou a tela de
 * detalhe com abas: é cálculo puro (dígito verificador, faixa interna) e
 * impressão, nada disso depende de estado de formulário — e cálculo dentro de
 * componente não tem como ser testado sem montar a tela inteira.
 */

/** EAN-8 ou EAN-13: só dígitos, 8 ou 13 posições. */
export function isEanValid(code: string): boolean {
  return /^\d{8}$|^\d{13}$/.test(code);
}

/**
 * Dígito verificador do EAN-13, calculado sobre os 12 primeiros dígitos.
 *
 * Pesos alternados 1 e 3 a partir da primeira posição, como manda o padrão
 * GS1. Errar o peso não gera erro em lugar nenhum: a etiqueta imprime, o
 * leitor do caixa recusa, e a venda para com o produto na mão do cliente.
 */
export function calculateEan13CheckDigit(code: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(code[i], 10) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/**
 * O código que a prévia desenha e a etiqueta imprime.
 *
 * Se o operador digitou um EAN válido, é ele — é o código da fábrica, impresso
 * na embalagem, e reescrevê-lo faria a loja ler um número que o produto não
 * tem. Sem EAN válido, gera-se um da faixa **interna** (prefixo `2`, reservada
 * pela GS1 para uso da própria loja, sem risco de colidir com produto de
 * fabricante).
 *
 * O sufixo é o que o operador digitou, quando for numérico e couber nas 11
 * posições; senão é o id do produto. Produto ainda não salvo cai no `1`, e a
 * prévia serve só de amostra até o cadastro existir.
 */
export function buildDisplayBarcode(barcode: string, productId: number | null): string {
  if (isEanValid(barcode)) return barcode;

  const isNumeric = /^\d+$/.test(barcode);
  const suffix = isNumeric && barcode.length > 0 && barcode.length <= 11 ? barcode : String(productId || 1);

  const prefix12 = "2" + suffix.padStart(11, "0");
  return prefix12 + calculateEan13CheckDigit(prefix12).toString();
}

/**
 * O código digitado é EAN de fábrica?
 *
 * 13 dígitos válidos que NÃO começam com `2` — o `2` é a faixa interna gerada
 * aqui. Serve para a tela piscar a borda em verde quando o operador termina de
 * bipar o código da embalagem, confirmando que o leitor pegou o número inteiro.
 */
export function isFactoryEan(barcode: string): boolean {
  return isEanValid(barcode) && barcode.length === 13 && !barcode.startsWith("2");
}

type PrintBarcodeLabelParams = {
  /** Código já resolvido — use {@link buildDisplayBarcode} antes de chamar. */
  barcode: string;
  /** Nome impresso acima do código. */
  name: string;
  /** Preço impresso abaixo do código. */
  price: number;
};

/**
 * Imprime a etiqueta de 80mm x 40mm num iframe fora da tela.
 *
 * O iframe existe para não levar a página inteira para a impressora: `print()`
 * na janela principal imprimiria o admin. O `postMessage` avisa o fim da
 * impressão para o iframe ser removido — sem isso cada impressão deixaria um
 * documento órfão no DOM.
 */
export function printBarcodeLabel({ barcode, name, price }: PrintBarcodeLabelParams): void {
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

  const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Imprimir Etiqueta</title>
        <style>
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
          svg { max-width: 100%; height: auto; }
        </style>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      </head>
      <body>
        <div class="name">${(name || "Produto").toUpperCase().substring(0, 30)}</div>
        <svg id="barcode"></svg>
        <div class="price">${formatCurrency(price || 0)}</div>
        <script>
          window.onload = () => {
            JsBarcode("#barcode", "${barcode}", {
              format: "${barcode.length === 8 ? "EAN8" : barcode.length === 13 ? "EAN13" : "CODE128"}",
              width: 2,
              height: 40,
              displayValue: true,
              fontSize: 14,
              margin: 0
            });
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
  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();
}

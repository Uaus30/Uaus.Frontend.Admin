import { formatCurrency } from "@workspace/core";

/**
 * Código de barras do produto: validação, prévia e impressão da etiqueta.
 *
 * Morava dentro da modal de edição. Saiu de lá quando a modal virou a tela de
 * detalhe com abas: é cálculo puro (dígito verificador, faixa interna) e
 * impressão, nada disso depende de estado de formulário — e cálculo dentro de
 * componente não tem como ser testado sem montar a tela inteira.
 */

/** Formatos que a prévia desenha e a etiqueta imprime; CODE128 é o coringa. */
export type BarcodeFormat = "EAN13" | "EAN8" | "CODE128";

/**
 * EAN-8 ou EAN-13 pelo FORMATO: só dígitos, 8 ou 13 posições.
 *
 * Confere o desenho do código, não o dígito verificador — quem faz isso é
 * {@link hasValidEanCheckDigit}. A separação é proposital: um código com
 * verificador errado continua sendo o código gravado no cadastro, e reescrevê-lo
 * faria a prévia e a etiqueta mostrarem um número que o produto não tem.
 */
export function isEanValid(code: string): boolean {
  return /^\d{8}$|^\d{13}$/.test(code);
}

/**
 * Dígito verificador de um corpo de EAN — 12 dígitos no EAN-13, 7 no EAN-8.
 *
 * Pesos alternados 3 e 1 a partir da DIREITA, como manda o padrão GS1 (é o que
 * põe o peso 3 na segunda posição do EAN-13 e na primeira do EAN-8). Errar o
 * peso não gera erro em lugar nenhum: a etiqueta imprime, o leitor do caixa
 * recusa, e a venda para com o produto na mão do cliente.
 */
function calculateEanCheckDigit(body: string): number {
  const sum = body
    .split("")
    .reverse()
    .reduce((acc, digit, index) => acc + parseInt(digit, 10) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

/** Dígito verificador do EAN-13, calculado sobre os 12 primeiros dígitos. */
export function calculateEan13CheckDigit(code: string): number {
  return calculateEanCheckDigit(code.slice(0, 12));
}

/**
 * O dígito verificador do código fecha com os dígitos anteriores?
 *
 * Vale para EAN-8 e EAN-13; qualquer outro comprimento é `false`, porque aí não
 * há verificador para conferir.
 */
export function hasValidEanCheckDigit(code: string): boolean {
  if (!isEanValid(code)) return false;
  return calculateEanCheckDigit(code.slice(0, -1)) === parseInt(code.slice(-1), 10);
}

/**
 * Simbologia com que o código vai ser desenhado.
 *
 * EAN fiel quando o verificador fecha; **CODE128 em todo o resto**, que aceita
 * qualquer texto. Sem esse desvio a jsbarcode lança para EAN com verificador
 * errado, e o que sobra na tela é a moldura branca vazia do `<svg>` (300x150,
 * o tamanho padrão de SVG sem conteúdo) — foi assim que a prévia do produto
 * apareceu em branco. O catálogo tem códigos assim de verdade: a importação do
 * sistema antigo trouxe 28 códigos internos de 13 dígitos cujo verificador não
 * fecha, e o operador ainda pode digitar um errado.
 *
 * Trocar de simbologia preserva o NÚMERO — a etiqueta impressa continua sendo a
 * do código cadastrado, que é o que o PDV procura ao bipar. Gerar outro código
 * no lugar imprimiria uma etiqueta que o caixa não encontra.
 */
export function resolveBarcodeFormat(code: string): BarcodeFormat {
  if (code.length === 13 && hasValidEanCheckDigit(code)) return "EAN13";
  if (code.length === 8 && hasValidEanCheckDigit(code)) return "EAN8";
  return "CODE128";
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
              format: "${resolveBarcodeFormat(barcode)}",
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

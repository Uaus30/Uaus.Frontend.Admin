import JsBarcode from "jsbarcode";

/**
 * Código de barras do produto: validação, prévia e desenho das barras.
 *
 * Morava dentro da modal de edição. Saiu de lá quando a modal virou a tela de
 * detalhe com abas: é cálculo puro (dígito verificador, faixa interna), nada
 * disso depende de estado de formulário — e cálculo dentro de componente não
 * tem como ser testado sem montar a tela inteira.
 *
 * A etiqueta de 80mm, que consome o daqui, está em `barcodeLabel.ts`.
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

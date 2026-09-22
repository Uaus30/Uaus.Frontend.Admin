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

/**
 * Largura padrão do módulo (a barra mais fina), em px. Exportada porque quem
 * quer barras "20% maiores" precisa partir deste número, e não de uma cópia
 * dele que envelhece sozinha.
 */
export const DEFAULT_BARCODE_MODULE_WIDTH = 1.8;

/** Ajustes de desenho que mudam de uma etiqueta para outra. */
type BarcodeSvgOptions = {
  /** Largura do módulo (a barra mais fina), em px. */
  width?: number;
  /** Altura das barras, em px. */
  height?: number;
  /** Fonte do número impresso sob as barras. */
  font?: string;
  /** Corpo do número impresso sob as barras, em px. */
  fontSize?: number;
  /** Distância entre as barras e o número, em px. */
  textMargin?: number;
  /**
   * Folga abaixo do número, em px.
   *
   * A jsbarcode encosta a **linha de base** do texto na borda de baixo do SVG,
   * e o SVG recorta o que passa dela: a barriga do 8, do 9 e do 5 saía cortada
   * na impressão. Não é margem estética — é o que falta para o glifo caber.
   */
  marginBottom?: number;
  /**
   * Desenho **reto** do EAN/UPC: sem as barras de guarda mais compridas e sem o
   * primeiro dígito solto na lateral — todas as barras na mesma altura e o
   * número inteiro centralizado embaixo, como no CODE128.
   *
   * Também solta o corpo do número: no desenho guardado a jsbarcode limita a
   * fonte a `width * 10` (ver `EAN.js`), então `fontSize` grande só tem efeito
   * aqui.
   */
  flat?: boolean;
  /**
   * Deixa o desenho **preencher** a caixa em vez de caber nela
   * (`preserveAspectRatio="none"`).
   *
   * Serve para quem fixa a altura no CSS e limita a largura: no padrão
   * (`meet`), estreitar a caixa encolhe o desenho inteiro e a barra perde
   * altura junto — duas etiquetas da mesma folha saem com códigos de alturas
   * diferentes. Com `none`, a altura é sempre a da caixa e o aperto é só
   * horizontal, que o leitor tolera porque a **proporção entre as barras** não
   * muda (todas estreitam igual).
   */
  stretch?: boolean;
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
      width: options.width ?? DEFAULT_BARCODE_MODULE_WIDTH,
      height: options.height ?? 52,
      margin: 0,
      marginBottom: options.marginBottom ?? 0,
      background: "transparent",
      lineColor: "#000000",
      displayValue: true,
      font: options.font ?? "Arial",
      fontSize: options.fontSize ?? 14,
      textMargin: options.textMargin ?? 1,
      flat: options.flat ?? false,
    });

    // Depois do desenho: a jsbarcode escreve os atributos do SVG e sobrescreveria.
    if (options.stretch) svg.setAttribute("preserveAspectRatio", "none");
  } catch {
    // Código fora do alfabeto do formato: melhor etiqueta sem barras do que
    // derrubar a impressão do lote inteiro.
    return null;
  }

  return svg.outerHTML;
}

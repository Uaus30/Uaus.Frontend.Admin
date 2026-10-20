import { escapeHtml } from "@workspace/core";
import {
  BANNER_NAME_FONT_PT,
  DEFAULT_BANNER_TITLE,
  bannerNameStyle,
  type BannerTextMeasure,
  type PromotionBannerItem,
} from "./hooks/promotionBannerRules";

export { BANNER_NAME_FONT_PT, bannerNameStyle };

/**
 * A folha A4 dos banners de promoção (pedido do dono, 16/10/2026), no desenho
 * que ele simulou no Word: a faixa vermelha "PROMOÇÃO" em Cooper Black com
 * sombra, o nome do produto e o preço em Arial Black, colados uns nos outros e
 * separados por uma linha laranja fina — a guia da tesoura.
 *
 * **Quadrado, seis por folha (20/10/2026).** O primeiro banner era comprido, em
 * pé (95 × 135mm, quatro por folha), e na prateleira parecia apontar o preço
 * para o produto de baixo (relato do dono). O quadrado de 93mm cabe 2 × 3 na
 * área útil da A4; oito por folha exigiriam 70mm, com o preço bem menor e uma
 * faixa de papel sobrando.
 *
 * É o mesmo desenho de folha das etiquetas de gôndola (`gondola-labels/print.ts`):
 * medidas absolutas em milímetros, vizinhos dividindo UMA linha de corte (cada
 * banner desenha a borda da direita e a de baixo; a grade, a de cima e a da
 * esquerda) e a paginação feita aqui, por `.page`, e não pela quebra natural do
 * navegador. Duplicata consciente — são duas folhas com razões de mudar
 * diferentes (o banner não tem código de barras, nem lote, nem "De").
 *
 * **Aba nova, e não o iframe do cupom** (decisão do dono): se a impressão
 * falhar, a folha continua aberta para imprimir de novo com Ctrl+P ou pelo
 * botão, sem remontar a seleção. Por isso a folha carrega o próprio botão e o
 * próprio `print()` — nada depende da aba do admin depois de aberta.
 */

/** Banners por folha A4 em pé: 2 colunas × 3 linhas. */
export const BANNERS_PER_PAGE = 6;

/**
 * O lado do banner quadrado. 2 × 93mm e 3 × 93mm cabem nos 194 × 280mm úteis da
 * A4 com 8mm de margem, com folga para o arredondamento do navegador não empurrar
 * uma folha em branco entre as outras.
 */
export const BANNER_SIZE_MM = 93;

/** A linha de corte: laranja da Uaus, fina — é guia de tesoura, não moldura. */
export const CUT_LINE = "0.3mm solid #f7931e";

/**
 * Altura da faixa vermelha. Fixa, e não a do texto: o título reescrito encolhe
 * para caber, e a faixa não pode encolher junto — seis banners na mesma folha
 * com faixas de alturas diferentes pareceriam seis cartazes de lojas diferentes.
 * Eram 22mm no banner comprido; no quadrado, 20mm deixam ao preço o espaço do
 * corpo de 130pt.
 */
export const BANNER_HEAD_HEIGHT_MM = 20;

const SHEET_STYLES = `
  @page { size: A4 portrait; margin: 8mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: "Arial Black", Arial, Helvetica, sans-serif;
    color: #000;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  /* A área útil da A4 (210 − 2 × 8mm) com 1mm de folga na altura. A grade
     começa no canto superior ESQUERDO, e não centralizada como na etiqueta:
     com um ou dois banners, eles saem no alto do papel (pedido do dono,
     16/10/2026) — a sobra fica embaixo, inteira, para outro uso. */
  .page {
    width: 194mm;
    height: 280mm;
    display: flex;
    align-items: flex-start;
    justify-content: flex-start;
    break-after: page;
    page-break-after: always;
  }
  /* Dentro do contêiner, e não no body: o botão e o script também são filhos
     do body, e um ".page:last-child" solto nunca casaria — a última folha
     manteria a quebra forçada e toda impressão sairia com uma folha em branco
     no fim (achado da revisão de 16/10/2026). */
  .pages > .page:last-child { break-after: auto; page-break-after: auto; }
  .sheet {
    display: grid;
    grid-template-columns: repeat(2, ${BANNER_SIZE_MM}mm);
    grid-auto-rows: ${BANNER_SIZE_MM}mm;
    border-top: ${CUT_LINE};
    border-left: ${CUT_LINE};
  }
  /* Folha com um banner só: em duas colunas, a linha de cima da grade passaria
     por cima da célula vazia, e sobraria um traço sem banner. */
  .sheet.single { grid-template-columns: ${BANNER_SIZE_MM}mm; }
  .banner {
    width: ${BANNER_SIZE_MM}mm;
    height: ${BANNER_SIZE_MM}mm;
    background: #fff100;
    border-right: ${CUT_LINE};
    border-bottom: ${CUT_LINE};
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  /* A faixa toma o topo inteiro, de borda a borda — o amarelo começa embaixo
     dela, como no cartaz da loja (pedido do dono, 16/10/2026). Cooper Black já
     é preta: peso normal, senão o navegador engrossa por cima e a letra borra.
     A sombra é leve e deslocada, como no original. */
  .banner-head {
    width: 100%;
    height: ${BANNER_HEAD_HEIGHT_MM}mm;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 1.5mm;
    background: #e3000b;
    color: #fff;
    font-family: "Cooper Black", "Cooper Std", "Alfa Slab One", Georgia, serif;
    font-weight: 400;
    line-height: 1;
    letter-spacing: 0.01em;
    text-transform: uppercase;
    white-space: nowrap;
    text-shadow: 0.3mm 0.3mm 0.7mm rgba(0, 0, 0, 0.55);
  }
  /* O recuo lateral é do corpo, não do banner: a faixa não pode ter margem. */
  .banner-body {
    flex: 1;
    min-height: 0;
    width: 100%;
    padding: 0 4mm 4mm;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .banner-name {
    width: 100%;
    margin-top: 4mm;
    max-height: 12mm;
    font-weight: 900;
    line-height: 1.1;
    text-transform: uppercase;
    overflow: hidden;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
  }
  .banner-price-area {
    flex: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  /* A frase e o preço formam um bloco da largura do maior dos dois, centrado no
     banner; dentro dele a frase começa onde o preço começa — "3 POR" alinhado à
     esquerda do número, e não centrado sobre ele (pedido do dono, 20/10/2026). */
  .banner-price-block {
    max-width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .banner-lead {
    font-size: 15pt;
    font-weight: 900;
    line-height: 1;
    text-align: left;
    text-transform: uppercase;
    margin-bottom: 3mm;
  }
  /* Centavos menores e na mesma linha de base: "9" grande, ",90" menor. */
  .banner-price {
    display: flex;
    align-items: baseline;
    justify-content: center;
    font-weight: 900;
    letter-spacing: -0.03em;
    line-height: 0.85;
    white-space: nowrap;
  }
  /* Na tela, a folha como ela sai: para conferir antes de mandar imprimir, e
     para imprimir de novo sem voltar ao admin. */
  @media screen {
    body { background: #3a3a3a; padding: 8mm 0; }
    .page {
      box-sizing: content-box;
      padding: 8mm;
      margin: 0 auto 8mm;
      background: #fff;
      box-shadow: 0 2mm 8mm rgba(0, 0, 0, 0.45);
    }
    .reprint {
      position: fixed;
      top: 4mm;
      right: 4mm;
      padding: 3mm 5mm;
      border: 0;
      border-radius: 2mm;
      background: #f7931e;
      color: #000;
      font: 700 12pt Arial, Helvetica, sans-serif;
      cursor: pointer;
      box-shadow: 0 1mm 4mm rgba(0, 0, 0, 0.5);
    }
  }
  @media print { .reprint { display: none; } }
`;

/**
 * Roda DENTRO da folha: abre a caixa de impressão quando as fontes carregarem
 * e liga o botão de reimpressão. É inline porque a aba precisa funcionar
 * sozinha — inclusive depois de a aba do admin fechar.
 */
const SHEET_SCRIPT = `
  (function () {
    var imprimir = function () { window.focus(); window.print(); };
    var botao = document.getElementById("reprint");
    if (botao) botao.addEventListener("click", imprimir);
    var fontes = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var quandoPronto = function () { fontes.then(function () { setTimeout(imprimir, 150); }); };
    if (document.readyState === "complete") quandoPronto();
    else window.addEventListener("load", quandoPronto);
  })();
`;

/**
 * Corpo do título da faixa, em pt: "PROMOÇÃO" sai a 34pt (75mm dos 90mm úteis em
 * Cooper Black); título mais longo encolhe para caber numa linha só. A conta é a
 * largura média de uma letra maiúscula da Cooper Black (~0,8 em) sobre os 90mm,
 * com teto de 34pt e piso de 12pt.
 */
export function bannerTitleFontSizePt(title: string): number {
  const length = Math.max(1, title.trim().length);
  return Math.max(12, Math.min(34, Math.floor(318 / length)));
}

/**
 * A régua do nome no navegador de quem imprime: o canvas mede o texto na mesma
 * fonte e no mesmo corpo do papel (Arial Black a 15pt), e o resultado sai em mm.
 * É o mesmo navegador que vai desenhar a folha, então a conta bate com o papel.
 * Sem canvas (teste, navegador muito antigo), `null` — e a modal volta a contar
 * caracteres.
 */
export function createBannerNameMeasure(): BannerTextMeasure | null {
  try {
    const contexto = document.createElement("canvas").getContext("2d");
    if (!contexto) return null;
    contexto.font = `900 ${BANNER_NAME_FONT_PT}pt "Arial Black", Arial, Helvetica, sans-serif`;
    return (texto) => (contexto.measureText(texto).width * 25.4) / 96;
  } catch {
    return null;
  }
}

/** "1.234,50" dividido em inteiro e centavos, para os centavos saírem menores. */
export function splitBannerPrice(price: number): { integer: string; cents: string } {
  const [integer, cents = "00"] = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(price)
    .split(",");
  return { integer, cents };
}

/**
 * Corpo do número grande, em pt, pela quantidade de dígitos inteiros: "9" pode
 * ocupar a largura que "29" não teria. Os centavos saem com a metade.
 *
 * A loja é de preço máximo R$ 30 (dono, 20/10/2026): o preço tem no máximo dois
 * dígitos, e mesmo o kit do combo ("3 por") fica abaixo de 100. Os dois corpos
 * de verdade são, por isso, os maiores que cabem no quadrado: "29,90" a 108pt
 * ocupa ~82mm dos 85 úteis, e "9,90" a 140pt, com a frase acima e o nome em duas
 * linhas, cabe nos 73mm abaixo da faixa. Três dígitos ou mais só por garantia.
 */
export function bannerPriceFontSizePt(integer: string): number {
  const digits = integer.replace(/\D/g, "").length;
  if (digits <= 1) return 140;
  if (digits === 2) return 108;
  if (digits === 3) return 78;
  if (digits === 4) return 60;
  return 50;
}

function buildBannerCell(item: PromotionBannerItem, title: string): string {
  const name = bannerNameStyle(item.productName);
  const { integer, cents } = splitBannerPrice(item.price);
  const priceFontSize = bannerPriceFontSizePt(integer);

  return [
    `<div class="banner">`,
    `<div class="banner-head" style="font-size:${bannerTitleFontSizePt(title)}pt;">${escapeHtml(title)}</div>`,
    `<div class="banner-body">`,
    `<div class="banner-name" style="font-size:${name.fontSizePt}pt;-webkit-line-clamp:${name.lines};">`,
    escapeHtml(item.productName),
    `</div>`,
    `<div class="banner-price-area">`,
    `<div class="banner-price-block">`,
    item.lead ? `<div class="banner-lead">${escapeHtml(item.lead)}</div>` : "",
    `<div class="banner-price">`,
    `<span style="font-size:${priceFontSize}pt;">${integer}</span>`,
    `<span style="font-size:${priceFontSize / 2}pt;">,${cents}</span>`,
    `</div>`,
    `</div>`,
    `</div>`,
    `</div>`,
    `</div>`,
  ].join("");
}

/**
 * Monta a folha A4 dos banners. Cada item vira `copies` células idênticas,
 * preenchendo a grade 2 × 3 na ordem da lista, em folhas de
 * {@link BANNERS_PER_PAGE} a partir do canto superior esquerdo (ver `SHEET_STYLES`).
 *
 * @param title O texto da faixa vermelha, o mesmo em toda a folha. Já resolvido
 *   por `bannerTitleOf`; aqui um vazio sai vazio.
 */
export function buildPromotionBannerSheetHtml(
  items: PromotionBannerItem[],
  title: string = DEFAULT_BANNER_TITLE,
): string {
  const cells = items.flatMap((item) =>
    Array.from({ length: Math.max(1, item.copies) }, () => buildBannerCell(item, title)),
  );

  const pages: string[] = [];
  for (let start = 0; start < cells.length; start += BANNERS_PER_PAGE) {
    const pageCells = cells.slice(start, start + BANNERS_PER_PAGE);
    const sheetClass = pageCells.length === 1 ? "sheet single" : "sheet";
    pages.push(`<div class="page"><div class="${sheetClass}">${pageCells.join("")}</div></div>`);
  }

  return [
    "<!DOCTYPE html>",
    '<html lang="pt-BR">',
    "<head>",
    '<meta charset="utf-8" />',
    "<title>Banners de promoção</title>",
    // Reserva para a máquina sem a Cooper Black (ela vem com o Office). Com a
    // fonte instalada, o navegador nem baixa esta.
    '<link rel="preconnect" href="https://fonts.googleapis.com" />',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />',
    '<link href="https://fonts.googleapis.com/css2?family=Alfa+Slab+One&display=block" rel="stylesheet" />',
    `<style>${SHEET_STYLES}</style>`,
    "</head>",
    "<body>",
    '<button type="button" class="reprint" id="reprint">Imprimir de novo</button>',
    `<div class="pages">${pages.join("")}</div>`,
    `<script>${SHEET_SCRIPT}</script>`,
    "</body>",
    "</html>",
  ].join("");
}

/**
 * Abre a folha numa ABA NOVA e devolve se conseguiu.
 *
 * Por `blob:`, e não por `document.write`: o documento nasce inteiro, com URL,
 * e o script da folha roda lá dentro — a folha já carregada imprime de novo
 * sozinha, mesmo com o admin fechado. O `window.open` tem que acontecer no
 * clique, de forma síncrona, senão o bloqueador de pop-up segura; `null` é o
 * sinal de que segurou, e quem chama avisa.
 *
 * A URL não é revogada aqui de propósito (são uns poucos KB por impressão),
 * mas o navegador a revoga quando a aba do admin recarrega ou fecha: a partir
 * daí o F5 na aba da folha dá em branco — o botão "Imprimir de novo" continua
 * funcionando, porque o documento já está lá.
 */
export function openPromotionBannerTab(html: string): boolean {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const tab = window.open(url, "_blank");
  if (!tab) {
    URL.revokeObjectURL(url);
    return false;
  }
  return true;
}

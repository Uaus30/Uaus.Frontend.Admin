import { escapeHtml } from "@workspace/core";
import { DEFAULT_BANNER_TITLE, type PromotionBannerItem } from "./hooks/promotionBannerRules";

/**
 * A folha A4 dos banners de promoção (pedido do dono, 16/10/2026), no desenho
 * que ele simulou no Word: a faixa vermelha "PROMOÇÃO" em Cooper Black com
 * sombra, o nome do produto e o preço em Arial Black, quatro por folha em pé,
 * colados uns nos outros e separados por uma linha laranja fina — a guia da
 * tesoura.
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

/** Banners por folha A4 em pé: 2 colunas × 2 linhas. */
export const BANNERS_PER_PAGE = 4;

/**
 * Medidas do banner. 2 × 95mm e 2 × 135mm cabem nos 194 × 281mm úteis da A4
 * com 8mm de margem, com folga para o arredondamento do navegador não empurrar
 * uma folha em branco entre as outras.
 */
export const BANNER_WIDTH_MM = 95;
export const BANNER_HEIGHT_MM = 135;

/** A linha de corte: laranja da Uaus, fina — é guia de tesoura, não moldura. */
export const CUT_LINE = "0.3mm solid #f7931e";

/**
 * Altura da faixa vermelha. Fixa, e não a do texto: o título reescrito encolhe
 * para caber, e a faixa não pode encolher junto — quatro banners na mesma folha
 * com faixas de alturas diferentes pareceriam quatro cartazes de lojas diferentes.
 */
export const BANNER_HEAD_HEIGHT_MM = 22;

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
    grid-template-columns: repeat(2, ${BANNER_WIDTH_MM}mm);
    grid-auto-rows: ${BANNER_HEIGHT_MM}mm;
    border-top: ${CUT_LINE};
    border-left: ${CUT_LINE};
  }
  /* Folha com um banner só: em duas colunas, a linha de cima da grade passaria
     por cima da célula vazia, e sobraria um traço sem banner. */
  .sheet.single { grid-template-columns: ${BANNER_WIDTH_MM}mm; }
  .banner {
    width: ${BANNER_WIDTH_MM}mm;
    height: ${BANNER_HEIGHT_MM}mm;
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
    padding: 0 5mm 6mm;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .banner-name {
    width: 100%;
    margin-top: 7mm;
    max-height: 25mm;
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
  .banner-lead {
    font-size: 15pt;
    font-weight: 900;
    line-height: 1;
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
 * Corpo do título da faixa, em pt: "PROMOÇÃO" sai a 34pt (75mm dos 92mm úteis em
 * Cooper Black); título mais longo encolhe para caber numa linha só. A conta é a
 * largura média de uma letra maiúscula da Cooper Black (~0,8 em) sobre os 92mm,
 * com teto de 34pt e piso de 12pt.
 */
export function bannerTitleFontSizePt(title: string): number {
  const length = Math.max(1, title.trim().length);
  return Math.max(12, Math.min(34, Math.floor(325 / length)));
}

/**
 * Corpo do nome, em pt, e quantas linhas cabem nos 25mm do bloco — o nome longo
 * encolhe, como na etiqueta. Os cortes foram estimados para Arial Black caixa
 * alta nos 85mm de largura útil: ~15 letras por linha a 22pt, ~26 a 12,5pt.
 */
export function bannerNameStyle(name: string): { fontSizePt: number; lines: number } {
  const texto = name.trim();
  const tier = nameTierOf(texto.length);

  // A palavra mais longa tem que caber numa linha: "DESENGORDURANTE" (15 letras)
  // a 22pt passa dos 85mm e quebraria no meio. Medido em Arial Black caixa alta:
  // ~0,78 em por letra, logo 309 / letras é o corpo em pt que ainda cabe.
  const longestWord = Math.max(1, ...texto.split(/\s+/).map((word) => word.length));
  const cap = Math.max(12, Math.floor(309 / longestWord));

  return { fontSizePt: Math.min(tier.fontSizePt, cap), lines: tier.lines };
}

function nameTierOf(length: number): { fontSizePt: number; lines: number } {
  if (length <= 16) return { fontSizePt: 22, lines: 2 };
  if (length <= 30) return { fontSizePt: 18, lines: 3 };
  if (length <= 48) return { fontSizePt: 15, lines: 3 };
  return { fontSizePt: 12.5, lines: 4 };
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
 * ocupar a largura que "199" não teria. Os centavos saem com a metade.
 */
export function bannerPriceFontSizePt(integer: string): number {
  const digits = integer.replace(/\D/g, "").length;
  if (digits <= 1) return 130;
  if (digits === 2) return 100;
  if (digits === 3) return 80;
  if (digits === 4) return 62;
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
    item.lead ? `<div class="banner-lead">${escapeHtml(item.lead)}</div>` : "",
    `<div class="banner-price">`,
    `<span style="font-size:${priceFontSize}pt;">${integer}</span>`,
    `<span style="font-size:${priceFontSize / 2}pt;">,${cents}</span>`,
    `</div>`,
    `</div>`,
    `</div>`,
    `</div>`,
  ].join("");
}

/**
 * Monta a folha A4 dos banners. Cada item vira `copies` células idênticas,
 * preenchendo a grade 2 × 2 na ordem da lista, em folhas de
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

import { escapeHtml } from "@workspace/core";
import { STORE_LOGO_DATA_URI } from "./logo";
import {
  RECEIPT_FOOTER_MESSAGE,
  STORE_INFO,
  isStoreInfo,
  resolveStoreInfo,
  toReceiptStore,
} from "./store-info";
import type { ReceiptStore, StoreInfo } from "./types";

/** Largura do papel da bobina térmica. */
const PAPER_WIDTH_MM = 80;
/** Margem lateral que sobra fora da área imprimível da cabeça térmica. */
const PAPER_PADDING_MM = 3;
/**
 * Recuo à esquerda.
 *
 * Zerado de propósito: a cabeça térmica já começa a imprimir alguns milímetros
 * depois da borda do papel, e o recuo do CSS se somava a essa folga física,
 * desperdiçando largura útil e empurrando o conteúdo para a direita.
 *
 * É aqui que se ajusta se a impressora da loja cortar o começo das linhas.
 */
const PAPER_PADDING_LEFT_MM = 0;
/** Avanço de papel no rodapé, para o corte não pegar a última linha. */
const PAPER_FEED_MM = 8;

/**
 * Escala aplicada a todos os tamanhos de fonte do impresso.
 *
 * A resolução da impressora térmica é baixa, e nos corpos menores a perda de
 * definição comia o texto. Subir um degrau recupera a legibilidade a um custo de
 * papel aceitável.
 *
 * Mexa **aqui**, e não nos tamanhos individuais: eles foram equilibrados entre
 * si, e alterar um de cada vez desfaz a hierarquia do cupom.
 */
const FONT_SCALE = 1.15;

/** Aplica a escala e arredonda para meio pixel, que é o passo que o motor respeita. */
function fontSize(basePx: number) {
  return `${Math.round(basePx * FONT_SCALE * 2) / 2}px`;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const quantityFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

/** Formata um valor em reais. */
export function formatReceiptCurrency(value: number) {
  return currencyFormatter.format(value ?? 0);
}

/** Formata uma quantidade, sem casas decimais quando ela é inteira. */
export function formatReceiptQuantity(value: number) {
  return quantityFormatter.format(value ?? 0);
}

/** Formata data e hora completas. */
export function formatReceiptDateTime(value: string | Date) {
  return dateTimeFormatter.format(toDate(value));
}

/** Formata apenas a hora. */
export function formatReceiptTime(value: string | Date) {
  return timeFormatter.format(toDate(value));
}

/** Aceita tanto a string da API quanto um Date já pronto. */
export function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

// A implementação vive em @workspace/core: havia duas no repositório e esta NÃO
// escapava aspa simples, então o mesmo nome de produto saía seguro na etiqueta
// de gôndola e inseguro no cupom.
export { escapeHtml };

/** Uma linha "rótulo à esquerda, valor à direita". */
export function row(label: string, value: string, className = "") {
  return `<div class="row ${className}"><span class="row-label">${label}</span><span class="row-value">${value}</span></div>`;
}

/** Título centralizado que separa os blocos do impresso. */
export function sectionTitle(title: string) {
  return `<div class="section-title">${title}</div>`;
}

/** Linha tracejada separando blocos. */
export const divider = `<div class="divider"></div>`;

/** Faixa em destaque, com borda, usada para carimbos. */
export function banner(text: string, className = "") {
  return `<div class="banner ${className}">${text}</div>`;
}

/**
 * Cabeçalho comum a todo impresso: logo, nome fantasia e dados da loja.
 *
 * @param store Dados da loja, já mesclados com os padrões.
 */
export function storeHeader(store: ReceiptStore) {
  const lines = [...store.addressLines, store.phone, store.document]
    .filter((line): line is string => Boolean(line))
    .map((line) => `<div class="store-line">${escapeHtml(line)}</div>`)
    .join("");

  return `<img class="logo" src="${STORE_LOGO_DATA_URI}" alt="" />
  <div class="store-name">${escapeHtml(store.name)}</div>
  ${lines}`;
}

/** Identidade pronta para impressão: cabeçalho e rodapé já resolvidos. */
export interface ResolvedStore extends ReceiptStore {
  /** Mensagem de agradecimento impressa no rodapé. */
  footerMessage: string;
}

/**
 * Mescla os dados padrão da loja com o que o impresso sobrescreveu.
 *
 * Aceita as duas formas de sobrescrita: a identidade completa do cadastro
 * (`StoreInfo`, que passa de novo por `resolveStoreInfo` para garantir o
 * fallback de campo vazio) e a sobrescrita avulsa por campo do cabeçalho.
 */
export function resolveStore(overrides?: Partial<ReceiptStore> | StoreInfo): ResolvedStore {
  if (overrides && isStoreInfo(overrides)) {
    const info = resolveStoreInfo(overrides);
    return { ...toReceiptStore(info), footerMessage: info.receiptFooterMessage };
  }
  return { ...STORE_INFO, footerMessage: RECEIPT_FOOTER_MESSAGE, ...overrides };
}

/**
 * Folha de estilo dos impressos de 80mm.
 *
 * Nada aqui depende do CSS do app: o documento é impresso dentro de um iframe
 * isolado, então precisa ser autossuficiente.
 */
const PRINT_STYLES = `
  @page { size: ${PAPER_WIDTH_MM}mm auto; margin: 0; }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
  }

  body {
    width: ${PAPER_WIDTH_MM}mm;
    /* Topo, direita, rodapé (sobra para a serrilha não comer a última linha) e
       esquerda — que é zero para aproveitar a largura toda da bobina. */
    padding: ${PAPER_PADDING_MM}mm ${PAPER_PADDING_MM}mm ${PAPER_FEED_MM}mm ${PAPER_PADDING_LEFT_MM}mm;
    color: #000;
    font-family: "Helvetica Neue", Arial, "Segoe UI", sans-serif;
    font-size: ${fontSize(12)};
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .logo {
    display: block;
    width: 16mm;
    height: auto;
    margin: 0 auto 2mm;
  }

  .store-name {
    text-align: center;
    /* Arial Black é bem mais encorpada que o negrito da Arial comum, e traço
       grosso é o que a cabeça térmica imprime melhor. O peso 900 vem junto para
       o navegador engrossar a fonte substituta quando a Arial Black não existir
       na máquina (é uma fonte do Windows). */
    font-family: "Arial Black", "Arial Bold", "Helvetica Neue", Arial, sans-serif;
    font-size: ${fontSize(15)};
    font-weight: 900;
    letter-spacing: 0.02em;
  }

  .store-line {
    text-align: center;
    font-size: ${fontSize(10)};
  }

  .divider {
    border-top: 1px dashed #000;
    margin: 2mm 0;
  }

  .section-title {
    text-align: center;
    font-size: ${fontSize(10)};
    font-weight: 700;
    letter-spacing: 0.12em;
    margin-bottom: 1mm;
  }

  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 2mm;
  }

  .row-label { flex: 1; word-break: break-word; }
  .row-value { white-space: nowrap; text-align: right; }

  .item + .item { margin-top: 1.5mm; }

  .item-head {
    font-size: ${fontSize(11)};
    font-weight: 600;
  }

  /* Código de barras acima da descrição: é dado de conferência, não de leitura,
     então vem no menor corpo do cupom e sem negrito. */
  .item-barcode {
    font-size: ${fontSize(9)};
    font-weight: 400;
  }

  .item-breakdown { font-size: ${fontSize(10)}; }

  /* Cabeçalho das colunas dos itens: é rótulo, não conteúdo, então acompanha o
     corpo dos títulos de seção em vez do corpo do nome do produto. */
  .row.items-header {
    font-size: ${fontSize(10)};
    font-weight: 700;
    letter-spacing: 0.08em;
  }

  .row.total {
    font-size: ${fontSize(15)};
    font-weight: 700;
    margin-top: 1mm;
  }

  .row.strong { font-weight: 700; }
  .row.small { font-size: ${fontSize(10)}; }
  .row.muted .row-value { font-variant-numeric: tabular-nums; }

  /* Identificação do consumidor: rótulo e documento na mesma linha. Usa o mesmo
     corpo dos títulos de seção, mas alinhada à esquerda — é uma linha de
     conteúdo, não um separador. */
  .consumer {
    font-size: ${fontSize(10)};
    font-weight: 700;
    letter-spacing: 0.12em;
  }

  .meta-line {
    font-size: ${fontSize(10)};
    display: flex;
    justify-content: space-between;
    gap: 2mm;
  }

  .notes { font-size: ${fontSize(10)}; }

  .banner {
    margin: 1.5mm 0;
    padding: 1mm 0;
    border: 1px solid #000;
    text-align: center;
    font-size: ${fontSize(11)};
    font-weight: 700;
    letter-spacing: 0.1em;
  }

  .banner.cancelled { border-width: 2px; }

  .footer {
    /* Uma linha inteira de respiro antes do agradecimento, separando-o dos
       dados da venda. */
    margin-top: 7mm;
    text-align: center;
    font-size: ${fontSize(13)};
    font-weight: 700;
  }

  .fine-print {
    margin-top: 1mm;
    text-align: center;
    font-size: ${fontSize(9)};
  }

  .struck { text-decoration: line-through; }
`;

/**
 * Envolve o conteúdo num documento HTML completo, pronto para impressão.
 *
 * @param title Título do documento, usado pelo navegador na caixa de impressão.
 * @param body Conteúdo já montado do impresso.
 */
export function wrapPrintDocument(title: string, body: string) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>${PRINT_STYLES}</style>
</head>
<body>
${body}
</body>
</html>`;
}

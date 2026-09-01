import type { AppliedCoupon, HeldSale, PdvConsumer, PdvItem } from "./pdv-cart";

/**
 * Tudo que o PDV guarda no `localStorage` do terminal: a venda em andamento, a
 * fila de espera e as preferências de tela.
 *
 * Está separado de `use-pdv-store.ts` porque o store é a máquina de estado e
 * isto aqui é a borda com o navegador — a parte que sabe o nome das chaves, o
 * formato gravado e o que fazer com um valor corrompido.
 *
 * A regra que vale para TODA leitura daqui: valor inesperado é descartado em
 * silêncio, nunca propagado. Um PDV que abre sem a preferência salva é
 * recuperável em dois cliques; um que não abre, não — e quem descobre é o caixa
 * com a fila formada.
 */

const HELD_SALES_STORAGE_KEY = "pdv-held-sales";
const FONT_SCALE_STORAGE_KEY = "pdv-font-scale-index";
const CART_LAYOUT_STORAGE_KEY = "pdv-cart-layout";
const CURRENT_SALE_STORAGE_KEY = "pdv-current-sale";

/**
 * Escalas de fonte disponíveis, do menor para o maior.
 *
 * O teto é 120%, definido em 01/09/2026 depois de a escala de 135% ser testada
 * no balcão: o layout é medido em `rem`, então a raiz maior estica tudo junto e,
 * a partir dali, o resumo da venda comia a lista de itens e o nome do produto
 * não cabia mais na linha. Aumentar o teto de novo exige refazer essa conta na
 * tela do caixa, não só acrescentar um número aqui.
 */
export const FONT_SCALES = [0.85, 0.925, 1, 1.1, 1.2] as const;

/** Índice da escala 1x, usada como padrão. */
export const DEFAULT_FONT_SCALE_INDEX = 2;

/**
 * Como o resumo da venda apresenta as ações secundárias.
 *
 * - `extended`: os quatro botões (desconto, cupom, pausar, cancelar) ficam
 *   sempre visíveis no rodapé, do jeito que o PDV nasceu.
 * - `compact`: eles saem do rodapé e passam a viver atrás da engrenagem ao lado
 *   do finalizar, devolvendo altura para a lista de itens.
 *
 * É preferência DA MÁQUINA, como o tema — não do operador que sentou no caixa.
 */
export type CartLayout = "extended" | "compact";

/**
 * Formato da venda em andamento guardada no navegador.
 *
 * A versão existe para o dia em que o carrinho ganhar campo novo: um `v`
 * diferente do atual é descartado inteiro, em vez de restaurar meia venda a
 * partir de um formato que já não é o mesmo.
 */
export interface PersistedSale {
  v: 1;
  items: PdvItem[];
  globalDiscount: number;
  consumer: PdvConsumer;
  coupon: AppliedCoupon | null;
  editingSaleId: number | null;
  saleClientReference: string | null;
}

const CURRENT_SALE_VERSION = 1;

/**
 * Lê o layout do resumo da venda salvo no navegador.
 *
 * Qualquer valor que não seja exatamente `extended` cai no compacto, que virou o
 * padrão em 01/09/2026 depois do teste no balcão: as três faixas de botões do
 * rodapé estendido custavam a altura que falta na lista de itens. Só quem pediu
 * o estendido de propósito o recebe.
 */
export function readCartLayout(): CartLayout {
  return localStorage.getItem(CART_LAYOUT_STORAGE_KEY) === "extended" ? "extended" : "compact";
}

/** Grava o layout escolhido para o resumo da venda. */
export function persistCartLayout(layout: CartLayout) {
  localStorage.setItem(CART_LAYOUT_STORAGE_KEY, layout);
}

/**
 * Recupera as vendas em espera gravadas no navegador.
 *
 * Elas precisam sobreviver ao recarregamento da página — é o caso de uso: o
 * operador pausa, atende outro cliente e retoma.
 */
export function readHeldSales(): HeldSale[] {
  try {
    const stored = localStorage.getItem(HELD_SALES_STORAGE_KEY);
    if (!stored) return [];

    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (sale): sale is HeldSale =>
        typeof sale === "object" && sale !== null && Array.isArray((sale as HeldSale).items),
    );
  } catch {
    return [];
  }
}

/** Grava a fila de vendas em espera no navegador. */
export function persistHeldSales(heldSales: HeldSale[]) {
  try {
    localStorage.setItem(HELD_SALES_STORAGE_KEY, JSON.stringify(heldSales));
  } catch {
    // Cota estourada não pode derrubar a venda em andamento.
  }
}

/**
 * Lê a venda que estava em andamento quando a tela foi embora.
 *
 * O F5 no meio da venda existe — atualização do app, travamento do navegador,
 * toque errado no touchscreen — e o carrinho sumia inteiro, com o cliente no
 * balcão e os produtos já bipados. A venda pausada e as preferências já viviam
 * aqui; a venda em andamento passou a viver também.
 */
export function readCurrentSale(): PersistedSale | null {
  try {
    const stored = localStorage.getItem(CURRENT_SALE_STORAGE_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== "object" || parsed === null) return null;

    const sale = parsed as PersistedSale;
    if (sale.v !== CURRENT_SALE_VERSION || !Array.isArray(sale.items)) return null;

    return sale;
  } catch {
    return null;
  }
}

/** Grava a venda em andamento no navegador. */
export function persistCurrentSale(sale: Omit<PersistedSale, "v">) {
  try {
    localStorage.setItem(
      CURRENT_SALE_STORAGE_KEY,
      JSON.stringify({ ...sale, v: CURRENT_SALE_VERSION } satisfies PersistedSale),
    );
  } catch {
    // Cota estourada não pode derrubar a venda em andamento.
  }
}

/**
 * Lê o índice da escala de fonte, limitado ao intervalo válido.
 *
 * A ausência da chave precisa ser tratada antes da conversão: `Number(null)` é
 * zero, que é um índice válido, e o PDV abriria na menor fonte sem ninguém ter
 * pedido isso.
 */
export function readFontScaleIndex() {
  const stored = localStorage.getItem(FONT_SCALE_STORAGE_KEY);
  if (stored === null) return DEFAULT_FONT_SCALE_INDEX;

  const index = Number(stored);
  if (!Number.isInteger(index) || index < 0) {
    return DEFAULT_FONT_SCALE_INDEX;
  }

  // Índice ACIMA do teto vira o maior disponível, e não o padrão: quem estava
  // na escala de 135% removida em 01/09/2026 quer a maior que sobrou (120%), e
  // voltar para 100% na primeira abertura pareceria a preferência ter sumido.
  return Math.min(index, FONT_SCALES.length - 1);
}

/** Grava a escala de fonte escolhida. */
export function persistFontScaleIndex(index: number) {
  localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(index));
}

/**
 * Aplica a escala na raiz do documento. Todo o layout é medido em `rem`, então
 * mexer no `font-size` do `<html>` escala a interface inteira junto com o texto.
 */
export function applyFontScale(index: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${FONT_SCALES[index] * 100}%`;
}

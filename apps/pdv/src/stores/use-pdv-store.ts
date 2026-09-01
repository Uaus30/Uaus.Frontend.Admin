import { create } from "zustand";
import { computeSaleTotals } from "@workspace/core";
import {
  EMPTY_CONSUMER,
  computeCartTotals,
  toTotalsItems,
  type AppliedCoupon,
  type HeldSale,
  type PdvConsumer,
  type PdvItem,
} from "./pdv-cart";

/**
 * Os tipos do carrinho e a conta do total moram em `./pdv-cart`; aqui fica só a
 * máquina de estado. Eles são REEXPORTADOS abaixo porque a divisão é interna: o
 * repo inteiro importa de `@/stores/use-pdv-store`, e trocar 25 imports para
 * apontar para o arquivo novo seria mexer em tela para não mexer em nada.
 */
export { EMPTY_CONSUMER, computeCartTotals, couponDiscountFor, toTotalsItems } from "./pdv-cart";
export type { AppliedCoupon, CouponAnswer, HeldSale, PdvConsumer, PdvItem } from "./pdv-cart";

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
const DEFAULT_FONT_SCALE_INDEX = 2;

const HELD_SALES_STORAGE_KEY = "pdv-held-sales";
const FONT_SCALE_STORAGE_KEY = "pdv-font-scale-index";
const CART_LAYOUT_STORAGE_KEY = "pdv-cart-layout";

/**
 * Como o resumo da venda apresenta as ações secundárias.
 *
 * - `extended`: os quatro botões (desconto, cupom, pausar, cancelar) ficam
 *   sempre visíveis no rodapé, do jeito que o PDV nasceu.
 * - `compact`: eles saem do rodapé e passam a viver atrás da engrenagem ao lado
 *   do finalizar, devolvendo altura para a lista de itens.
 *
 * As duas convivem porque a escolha ainda está em teste no balcão. É preferência
 * DA MÁQUINA, como o tema — não do operador que sentou no caixa.
 */
export type CartLayout = "extended" | "compact";

/**
 * Estado local do PDV: carrinho, desconto da venda, vendas em espera e
 * preferências de tela. O histórico de vendas não vive aqui — vem sempre da API
 * pela sessão de caixa.
 */
interface PdvState {
  status: "IDLE" | "SELLING" | "CHECKOUT";
  items: PdvItem[];
  globalDiscount: number;
  /** Consumidor da venda em andamento. */
  consumer: PdvConsumer;
  /**
   * Cupom aplicado na venda, ou `null`. **Um por venda — não é cumulativo.**
   *
   * Guarda a definição, nunca o valor em reais: ver {@link AppliedCoupon}.
   */
  coupon: AppliedCoupon | null;
  theme: "light" | "dark";
  /** Como o rodapé do resumo da venda apresenta as ações secundárias. */
  cartLayout: CartLayout;
  /** Linha do carrinho que acabou de receber o bipe, ou `null`. */
  lastAddedItemId: string | null;
  /**
   * Contador de itens adicionados, usado só para reiniciar o realce.
   *
   * O id sozinho não basta: bipar DUAS vezes o mesmo produto não cria linha
   * nova, só soma a quantidade, e `lastAddedItemId` não mudaria — o realce não
   * piscaria de novo, que é justamente quando o operador mais precisa dele.
   */
  lastAddedSeq: number;
  /** Índice em {@link FONT_SCALES} da escala de fonte escolhida. */
  fontScaleIndex: number;
  /** Vendas pausadas, das mais recentes para as mais antigas. */
  heldSales: HeldSale[];
  /** ID da venda sendo reeditada, ou null numa venda nova. */
  editingSaleId: number | null;
  /**
   * Chave de idempotência da venda em andamento, gerada na primeira tentativa
   * de pagamento e reutilizada nas retentativas.
   *
   * É o que impede a venda duplicada no servidor: se o POST chegou lá mas a
   * resposta voltou como erro (um 504 do proxy, por exemplo), o operador clica
   * de novo em "Confirmar" e o reenvio com a MESMA chave é reconhecido pelo
   * índice único de `ClientReference` — com chave nova a cada clique, o servidor
   * gravaria uma segunda venda idêntica. Descartada só quando a venda confirma
   * (`finishSale`) ou é abandonada (`cancelSale`, `holdSale`, `clearSession`).
   */
  saleClientReference: string | null;

  /** Adiciona o produto ao carrinho, somando a quantidade se ele já estiver lá. */
  addItem: (item: Omit<PdvItem, "id">) => void;
  /** Remove a linha do carrinho e volta ao estado ocioso quando ele fica vazio. */
  removeItem: (id: string) => void;
  /** Define a quantidade da linha. A validação de estoque fica na tela. */
  updateQuantity: (id: string, quantity: number) => void;
  /** Aplica desconto por unidade na linha; zero restaura o preço de tabela. */
  applyItemDiscount: (id: string, discount: number) => void;
  /** Aplica desconto sobre o total da venda. */
  applyGlobalDiscount: (discount: number) => void;
  /**
   * Aplica (ou troca) o cupom da venda em andamento.
   *
   * Trocar substitui: um cupom por venda é invariante do banco
   * (`ux_coupon_redemptions_sale_id`), não convenção de tela.
   */
  applyCoupon: (coupon: AppliedCoupon) => void;
  /** Tira o cupom da venda. O abatimento some sozinho — ele nunca foi guardado. */
  removeCoupon: () => void;
  /** Define o consumidor da venda em andamento. */
  setConsumer: (consumer: PdvConsumer) => void;
  /** Abre o checkout; ignorado com o carrinho vazio. */
  setCheckout: () => void;
  /** Fecha o checkout e volta para a venda em andamento. */
  backToSelling: () => void;
  /** Descarta a venda em andamento sem gravar nada. */
  cancelSale: () => void;
  /** Limpa o carrinho depois que a venda foi gravada com sucesso. */
  finishSale: () => void;
  /**
   * Devolve a chave de idempotência da venda em andamento, gerando-a na
   * primeira chamada.
   *
   * @param generate Fábrica da chave (`newClientReference` do serviço de
   *   vendas); injetada para o store não depender do serviço.
   */
  ensureSaleClientReference: (generate: () => string) => string;

  /**
   * Guarda a venda em andamento na fila de espera e libera o caixa.
   * Ignorado com o carrinho vazio ou durante a reedição de uma venda gravada.
   *
   * @returns A venda pausada, ou null quando não havia o que pausar.
   */
  holdSale: () => HeldSale | null;
  /**
   * Traz uma venda em espera de volta ao carrinho, tirando-a da fila.
   * Ignorado quando já há itens no carrinho — quem chama decide o que fazer antes.
   *
   * @returns A venda retomada, ou null quando ela não existe mais.
   */
  resumeHeldSale: (id: string) => HeldSale | null;
  /** Descarta uma venda em espera sem retomá-la. */
  discardHeldSale: (id: string) => void;

  /** Troca o tema e persiste a escolha no navegador. */
  setTheme: (theme: "light" | "dark") => void;
  /** Troca o layout do resumo da venda e persiste a escolha no navegador. */
  setCartLayout: (layout: CartLayout) => void;
  /** Move a escala de fonte um degrau para cima (+1) ou para baixo (-1). */
  stepFontScale: (direction: 1 | -1) => void;
  /** Volta a fonte ao tamanho padrão. */
  resetFontScale: () => void;
  /** Carrega uma venda já finalizada no carrinho para reedição. */
  loadSaleForEditing: (saleId: number, items: PdvItem[], globalDiscount: number) => void;
  /** Marca (ou desmarca) qual venda está sendo reeditada. */
  setEditingSaleId: (id: number | null) => void;
  /** Zera o estado do PDV ao sair ou ao fechar o caixa. */
  clearSession: () => void;

  /** Soma dos itens já com os descontos de linha aplicados. */
  getSubtotal: () => number;
  /**
   * Abatimento do cupom NESTE instante, recalculado sobre o carrinho corrente.
   *
   * É função e não campo justamente para não existir número guardado: bipar um
   * item reajusta o abatimento sozinho.
   */
  getCouponDiscount: () => number;
  /** Subtotal menos o desconto da venda e o cupom, nunca negativo. */
  getTotal: () => number;
}

/** Atalho dos getters: os totais da venda que está no carrinho agora. */
const currentTotals = (state: Pick<PdvState, "items" | "globalDiscount" | "coupon">) =>
  computeCartTotals(state.items, state.globalDiscount, state.coupon);

/** Gera o identificador local de uma linha do carrinho ou de uma venda em espera. */
const generateId = () => Math.random().toString(36).slice(2, 11);

/**
 * Lê o layout do resumo da venda salvo no navegador.
 *
 * Qualquer valor que não seja exatamente `extended` cai no compacto, que virou o
 * padrão em 01/09/2026 depois do teste no balcão: as três faixas de botões do
 * rodapé estendido custavam a altura que falta na lista de itens. Só quem pediu
 * o estendido de propósito o recebe.
 */
const initialCartLayout: CartLayout =
  localStorage.getItem(CART_LAYOUT_STORAGE_KEY) === "extended" ? "extended" : "compact";

/**
 * Recupera as vendas em espera gravadas no navegador.
 *
 * Elas precisam sobreviver ao recarregamento da página — é o caso de uso: o
 * operador pausa, atende outro cliente e retoma. Conteúdo corrompido é
 * descartado em silêncio, já que a alternativa seria travar o PDV na abertura.
 */
function readHeldSales(): HeldSale[] {
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
function persistHeldSales(heldSales: HeldSale[]) {
  try {
    localStorage.setItem(HELD_SALES_STORAGE_KEY, JSON.stringify(heldSales));
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
function readFontScaleIndex() {
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

/**
 * Aplica a escala na raiz do documento. Todo o layout é medido em `rem`, então
 * mexer no `font-size` do `<html>` escala a interface inteira junto com o texto.
 */
function applyFontScale(index: number) {
  if (typeof document === "undefined") return;
  document.documentElement.style.fontSize = `${FONT_SCALES[index] * 100}%`;
}

const initialFontScaleIndex = readFontScaleIndex();

// Aplica tema e escala no carregamento do módulo para evitar flash de tela sem estilo.
const initialTheme = (localStorage.getItem("pdv-theme") as "light" | "dark") || "dark";
if (typeof window !== "undefined") {
  document.documentElement.classList.toggle("light", initialTheme === "light");
  document.documentElement.classList.toggle("dark", initialTheme !== "light");
  applyFontScale(initialFontScaleIndex);
}

export const usePdvStore = create<PdvState>((set, get) => ({
  status: "IDLE",
  items: [],
  globalDiscount: 0,
  consumer: EMPTY_CONSUMER,
  coupon: null,
  editingSaleId: null,
  saleClientReference: null,
  theme: initialTheme,
  cartLayout: initialCartLayout,
  lastAddedItemId: null,
  lastAddedSeq: 0,
  fontScaleIndex: initialFontScaleIndex,
  heldSales: readHeldSales(),

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId);

      // Qual linha recebeu o bipe sai daqui, e não de quem chamou: só o store
      // sabe se o produto virou linha nova ou somou na que já estava lá.
      if (existing) {
        return {
          status: "SELLING",
          items: state.items.map((i) =>
            i.id === existing.id ? { ...i, quantity: i.quantity + item.quantity } : i,
          ),
          lastAddedItemId: existing.id,
          lastAddedSeq: state.lastAddedSeq + 1,
        };
      }

      const id = generateId();
      return {
        status: "SELLING",
        items: [...state.items, { ...item, id }],
        lastAddedItemId: id,
        lastAddedSeq: state.lastAddedSeq + 1,
      };
    }),

  removeItem: (id) =>
    set((state) => {
      const items = state.items.filter((i) => i.id !== id);
      return { items, status: items.length === 0 ? "IDLE" : state.status };
    }),

  updateQuantity: (id, quantity) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
    })),

  applyItemDiscount: (id, discount) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, discount } : i)),
    })),

  applyGlobalDiscount: (discount) => set(() => ({ globalDiscount: discount })),

  applyCoupon: (coupon) => set(() => ({ coupon })),

  removeCoupon: () => set(() => ({ coupon: null })),

  setConsumer: (consumer) => set(() => ({ consumer })),

  setCheckout: () => set((state) => ({ status: state.items.length > 0 ? "CHECKOUT" : "IDLE" })),

  backToSelling: () => set((state) => ({ status: state.items.length > 0 ? "SELLING" : "IDLE" })),

  cancelSale: () =>
    set(() => ({
      status: "IDLE",
      items: [],
      // Carrinho vazio não tem linha realçada para apontar.
      lastAddedItemId: null,
      globalDiscount: 0,
      consumer: EMPTY_CONSUMER,
      // O cupom é da VENDA, não do caixa: mantê-lo aqui daria o desconto de
      // graça ao próximo cliente, e o resgate seria gravado no nome dele.
      coupon: null,
      editingSaleId: null,
      // A venda foi abandonada: a chave morre com ela. Reutilizá-la numa venda
      // futura faria o servidor engolir a nova como "duplicada" da antiga.
      saleClientReference: null,
    })),

  finishSale: () =>
    set(() => ({
      status: "IDLE",
      items: [],
      // Carrinho vazio não tem linha realçada para apontar.
      lastAddedItemId: null,
      globalDiscount: 0,
      consumer: EMPTY_CONSUMER,
      // O cupom já foi resgatado nesta venda; deixá-lo de pé o resgataria de
      // novo na venda seguinte, queimando um segundo uso do panfleto.
      coupon: null,
      editingSaleId: null,
      // Venda confirmada: a próxima venda precisa de chave própria.
      saleClientReference: null,
    })),

  ensureSaleClientReference: (generate) => {
    const current = get().saleClientReference;
    if (current) return current;

    const reference = generate();
    set(() => ({ saleClientReference: reference }));
    return reference;
  },

  holdSale: () => {
    const state = get();
    // Reedição mexe numa venda que já existe na API; pausá-la deixaria a fila
    // apontando para um registro que pode mudar por fora.
    if (state.items.length === 0 || state.editingSaleId !== null) return null;

    const held: HeldSale = {
      id: generateId(),
      heldAt: new Date().toISOString(),
      items: state.items,
      globalDiscount: state.globalDiscount,
      consumer: state.consumer,
      // A venda pausada guarda o cupom junto: o cliente que voltar para buscar
      // outro produto não pode ter que apresentar o panfleto de novo. O `total`
      // abaixo já sai com o abatimento aplicado, porque `getTotal` o deriva.
      coupon: state.coupon,
      total: state.getTotal(),
    };

    const heldSales = [held, ...state.heldSales];
    persistHeldSales(heldSales);

    set(() => ({
      heldSales,
      status: "IDLE",
      items: [],
      // Carrinho vazio não tem linha realçada para apontar.
      lastAddedItemId: null,
      globalDiscount: 0,
      consumer: EMPTY_CONSUMER,
      // O cupom foi junto com a venda pausada; o caixa fica limpo para a próxima.
      coupon: null,
      editingSaleId: null,
      // A chave pertence à venda pausada, não ao caixa: mantê-la faria a
      // próxima venda nova reutilizar a chave de outra venda.
      saleClientReference: null,
    }));

    return held;
  },

  resumeHeldSale: (id) => {
    const state = get();
    if (state.items.length > 0) return null;

    const held = state.heldSales.find((sale) => sale.id === id);
    if (!held) return null;

    const heldSales = state.heldSales.filter((sale) => sale.id !== id);
    persistHeldSales(heldSales);

    set(() => ({
      heldSales,
      status: "SELLING",
      items: held.items,
      globalDiscount: held.globalDiscount,
      consumer: held.consumer,
      // `?? null`: as vendas pausadas antes desta feature continuam gravadas no
      // navegador e voltam sem o campo. Ler `undefined` como cupom deixaria o
      // estado do store fora do contrato e quebraria o carrinho na retomada.
      coupon: held.coupon ?? null,
      editingSaleId: null,
    }));

    return held;
  },

  discardHeldSale: (id) =>
    set((state) => {
      const heldSales = state.heldSales.filter((sale) => sale.id !== id);
      persistHeldSales(heldSales);
      return { heldSales };
    }),

  setTheme: (theme) => {
    localStorage.setItem("pdv-theme", theme);
    if (typeof window !== "undefined") {
      document.documentElement.classList.toggle("light", theme === "light");
      document.documentElement.classList.toggle("dark", theme !== "light");
    }
    set(() => ({ theme }));
  },

  setCartLayout: (layout) => {
    localStorage.setItem(CART_LAYOUT_STORAGE_KEY, layout);
    set(() => ({ cartLayout: layout }));
  },

  stepFontScale: (direction) => {
    const next = Math.min(FONT_SCALES.length - 1, Math.max(0, get().fontScaleIndex + direction));
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(next));
    applyFontScale(next);
    set(() => ({ fontScaleIndex: next }));
  },

  resetFontScale: () => {
    localStorage.setItem(FONT_SCALE_STORAGE_KEY, String(DEFAULT_FONT_SCALE_INDEX));
    applyFontScale(DEFAULT_FONT_SCALE_INDEX);
    set(() => ({ fontScaleIndex: DEFAULT_FONT_SCALE_INDEX }));
  },

  // O cupom NÃO volta na reedição, e isso é limitação DECLARADA, não descuido: a
  // venda da API devolve o snapshot do resgate (código, tipo, valor) mas não as
  // respostas do questionário, e sem elas o bloco do payload sairia incompleto.
  // Enquanto a reedição não souber remontá-lo, ela reenvia a venda sem cupom — o
  // servidor estorna o resgate e o abatimento fica no cabeçalho como desconto
  // manual, o que pode passar a exigir senha de administrador. Reeditar venda com
  // cupom continua sendo caminho a evitar: cancele e registre de novo.
  loadSaleForEditing: (saleId, items, globalDiscount) =>
    set(() => ({ items, globalDiscount, coupon: null, status: "SELLING", editingSaleId: saleId })),

  setEditingSaleId: (id) => set(() => ({ editingSaleId: id })),

  // As vendas em espera continuam gravadas de propósito: elas são do balcão,
  // não da sessão, e é justamente o que se espera ao trocar de operador.
  clearSession: () =>
    set(() => ({
      status: "IDLE",
      items: [],
      // Carrinho vazio não tem linha realçada para apontar.
      lastAddedItemId: null,
      globalDiscount: 0,
      consumer: EMPTY_CONSUMER,
      coupon: null,
      editingSaleId: null,
      saleClientReference: null,
    })),

  getSubtotal: () => computeSaleTotals({ items: toTotalsItems(get().items) }).subtotal,

  getCouponDiscount: () => currentTotals(get()).couponDiscount,

  getTotal: () => currentTotals(get()).total,
}));

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
import {
  DEFAULT_FONT_SCALE_INDEX,
  FONT_SCALES,
  applyFontScale,
  persistCartLayout,
  persistCurrentSale,
  persistFontScaleIndex,
  persistHeldSales,
  readCartLayout,
  readCurrentSale,
  readFontScaleIndex,
  readHeldSales,
  type CartLayout,
} from "./pdv-storage";

/**
 * Os tipos do carrinho e a conta do total moram em `./pdv-cart`; aqui fica só a
 * máquina de estado. Eles são REEXPORTADOS abaixo porque a divisão é interna: o
 * repo inteiro importa de `@/stores/use-pdv-store`, e trocar 25 imports para
 * apontar para o arquivo novo seria mexer em tela para não mexer em nada.
 */
export {
  EMPTY_CONSUMER,
  computeCartTotals,
  couponDiscountFor,
  itemListPrice,
  toTotalsItems,
} from "./pdv-cart";
export type { AppliedCoupon, CouponAnswer, HeldSale, PdvConsumer, PdvItem } from "./pdv-cart";

/**
 * A borda com o `localStorage` mora em `./pdv-storage`: nomes de chave, formato
 * gravado e o descarte do valor corrompido. Aqui fica só a máquina de estado.
 *
 * `FONT_SCALES` e `CartLayout` são REEXPORTADOS pelo mesmo motivo dos tipos do
 * carrinho: o repo inteiro os importa de `@/stores/use-pdv-store`, e a divisão é
 * interna.
 */
export { FONT_SCALES } from "./pdv-storage";
export type { CartLayout } from "./pdv-storage";

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
  /**
   * Aplica acréscimo por unidade na linha, com a justificativa que sai no cupom.
   * Zero remove o acréscimo e descarta a justificativa junto.
   */
  applyItemSurcharge: (id: string, surcharge: number, reason: string) => void;
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

const restoredSale = readCurrentSale();
const initialCartLayout = readCartLayout();

const initialFontScaleIndex = readFontScaleIndex();

// Aplica tema e escala no carregamento do módulo para evitar flash de tela sem estilo.
const initialTheme = (localStorage.getItem("pdv-theme") as "light" | "dark") || "dark";
if (typeof window !== "undefined") {
  document.documentElement.classList.toggle("light", initialTheme === "light");
  document.documentElement.classList.toggle("dark", initialTheme !== "light");
  applyFontScale(initialFontScaleIndex);
}

export const usePdvStore = create<PdvState>((set, get) => ({
  // Nunca `CHECKOUT`: o que a tela de pagamento tinha na mão (formas escolhidas,
  // parcelas, valor recebido) não é persistido, e reabri-la vazia por cima do
  // carrinho seria pior do que voltar para a venda. O operador clica em
  // FINALIZAR de novo — que é o que ele faria de qualquer jeito.
  status: restoredSale && restoredSale.items.length > 0 ? "SELLING" : "IDLE",
  items: restoredSale?.items ?? [],
  globalDiscount: restoredSale?.globalDiscount ?? 0,
  consumer: restoredSale?.consumer ?? EMPTY_CONSUMER,
  coupon: restoredSale?.coupon ?? null,
  editingSaleId: restoredSale?.editingSaleId ?? null,
  saleClientReference: restoredSale?.saleClientReference ?? null,
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

  // Valor e justificativa andam juntos, e por isso são zerados juntos: o
  // servidor recusa acréscimo sem motivo, e uma justificativa que sobrevive ao
  // acréscimo removido iria para o banco sozinha e derrubaria o CHECK
  // ck_sale_items_surcharge_com_motivo numa venda já paga.
  applyItemSurcharge: (id, surcharge, reason) =>
    set((state) => ({
      items: state.items.map((i) =>
        i.id === id
          ? {
              ...i,
              surcharge: surcharge > 0 ? surcharge : 0,
              surchargeReason: surcharge > 0 ? reason.trim() : "",
            }
          : i,
      ),
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
    persistCartLayout(layout);
    set(() => ({ cartLayout: layout }));
  },

  stepFontScale: (direction) => {
    const next = Math.min(FONT_SCALES.length - 1, Math.max(0, get().fontScaleIndex + direction));
    persistFontScaleIndex(next);
    applyFontScale(next);
    set(() => ({ fontScaleIndex: next }));
  },

  resetFontScale: () => {
    persistFontScaleIndex(DEFAULT_FONT_SCALE_INDEX);
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

/**
 * Espelha a venda em andamento no navegador a cada mudança dela.
 *
 * Uma assinatura só, e não uma gravação dentro de cada ação: são quinze
 * reducers mexendo no carrinho (item, quantidade, desconto, cupom, consumidor,
 * reedição, cancelamento), e a versão espalhada só precisaria de UM esquecido
 * para a venda restaurada voltar diferente da que estava na tela.
 *
 * A comparação é por identidade, que é o que o zustand garante: o estado é
 * imutável, então campo que não mudou continua sendo o mesmo objeto e o F5 não
 * paga uma escrita a cada troca de tema ou de escala de fonte.
 */
usePdvStore.subscribe((state, prev) => {
  const mudou =
    state.items !== prev.items ||
    state.globalDiscount !== prev.globalDiscount ||
    state.consumer !== prev.consumer ||
    state.coupon !== prev.coupon ||
    state.editingSaleId !== prev.editingSaleId ||
    state.saleClientReference !== prev.saleClientReference;

  if (!mudou) return;

  persistCurrentSale({
    items: state.items,
    globalDiscount: state.globalDiscount,
    consumer: state.consumer,
    coupon: state.coupon,
    editingSaleId: state.editingSaleId,
    // A chave de idempotência é o campo que MAIS precisa sobreviver ao F5: se o
    // POST chegou ao servidor e a resposta se perdeu junto com a tela, é ela que
    // faz a nova tentativa ser reconhecida como a mesma venda em vez de gravar
    // uma segunda idêntica.
    saleClientReference: state.saleClientReference,
  });
});

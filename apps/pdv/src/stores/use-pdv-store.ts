import { create } from "zustand";

/** Uma linha do carrinho de venda em andamento. */
export interface PdvItem {
  /** Identificador local da linha do carrinho. */
  id: string;
  productId: number;
  name: string;
  barcode?: string;
  /** Preço de tabela do produto. */
  price: number;
  quantity: number;
  /** Desconto em R$ por unidade. */
  discount: number;
  /** Estoque disponível no momento em que o item entrou no carrinho. */
  availableStock: number;
}

/**
 * Consumidor da venda. Ou é um cliente cadastrado (`customerId`), ou é o
 * CPF/CNPJ que o operador digitou no balcão.
 */
export interface PdvConsumer {
  customerId: number | null;
  /**
   * Nome do cliente cadastrado escolhido na busca, só para o operador conferir
   * quem selecionou. Fica vazio na venda de balcão — o PDV não coleta nome — e
   * não é impresso no cupom, que identifica o consumidor pelo documento.
   */
  name: string;
  /** CPF/CNPJ do consumidor: do cadastro escolhido, ou digitado no balcão. */
  document: string;
}

/** Uma venda pausada, à espera de ser retomada. */
export interface HeldSale {
  /** Identificador local; a venda em espera ainda não existe na API. */
  id: string;
  /** Momento em que a venda foi pausada, em ISO. */
  heldAt: string;
  items: PdvItem[];
  globalDiscount: number;
  consumer: PdvConsumer;
  /** Total no momento da pausa, para a lista não precisar recalcular. */
  total: number;
}

/** Escalas de fonte disponíveis, do menor para o maior. */
export const FONT_SCALES = [0.85, 0.925, 1, 1.1, 1.2, 1.35] as const;

/** Índice da escala 1x, usada como padrão. */
const DEFAULT_FONT_SCALE_INDEX = 2;

const HELD_SALES_STORAGE_KEY = "pdv-held-sales";
const FONT_SCALE_STORAGE_KEY = "pdv-font-scale-index";

/** Consumidor vazio: venda para consumidor não identificado. */
export const EMPTY_CONSUMER: PdvConsumer = { customerId: null, name: "", document: "" };

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
  theme: "light" | "dark";
  /** Abre a impressão do cupom assim que a venda é gravada. */
  autoPrintReceipt: boolean;
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
  /** Liga ou desliga a impressão automática do cupom e persiste a escolha. */
  setAutoPrintReceipt: (enabled: boolean) => void;
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
  /** Subtotal menos o desconto da venda, nunca negativo. */
  getTotal: () => number;
}

/** Gera o identificador local de uma linha do carrinho ou de uma venda em espera. */
const generateId = () => Math.random().toString(36).slice(2, 11);

/** Impressão automática só fica desligada quando o operador desligou de propósito. */
const initialAutoPrintReceipt = localStorage.getItem("pdv-auto-print-receipt") !== "false";

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
  if (!Number.isInteger(index) || index < 0 || index >= FONT_SCALES.length) {
    return DEFAULT_FONT_SCALE_INDEX;
  }
  return index;
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
  editingSaleId: null,
  saleClientReference: null,
  theme: initialTheme,
  autoPrintReceipt: initialAutoPrintReceipt,
  fontScaleIndex: initialFontScaleIndex,
  heldSales: readHeldSales(),

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find((i) => i.productId === item.productId);

      if (existing) {
        return {
          status: "SELLING",
          items: state.items.map((i) =>
            i.id === existing.id ? { ...i, quantity: i.quantity + item.quantity } : i,
          ),
        };
      }

      return {
        status: "SELLING",
        items: [...state.items, { ...item, id: generateId() }],
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

  setConsumer: (consumer) => set(() => ({ consumer })),

  setCheckout: () => set((state) => ({ status: state.items.length > 0 ? "CHECKOUT" : "IDLE" })),

  backToSelling: () => set((state) => ({ status: state.items.length > 0 ? "SELLING" : "IDLE" })),

  cancelSale: () =>
    set(() => ({
      status: "IDLE",
      items: [],
      globalDiscount: 0,
      consumer: EMPTY_CONSUMER,
      editingSaleId: null,
      // A venda foi abandonada: a chave morre com ela. Reutilizá-la numa venda
      // futura faria o servidor engolir a nova como "duplicada" da antiga.
      saleClientReference: null,
    })),

  finishSale: () =>
    set(() => ({
      status: "IDLE",
      items: [],
      globalDiscount: 0,
      consumer: EMPTY_CONSUMER,
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
      total: state.getTotal(),
    };

    const heldSales = [held, ...state.heldSales];
    persistHeldSales(heldSales);

    set(() => ({
      heldSales,
      status: "IDLE",
      items: [],
      globalDiscount: 0,
      consumer: EMPTY_CONSUMER,
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

  setAutoPrintReceipt: (enabled) => {
    localStorage.setItem("pdv-auto-print-receipt", String(enabled));
    set(() => ({ autoPrintReceipt: enabled }));
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

  loadSaleForEditing: (saleId, items, globalDiscount) =>
    set(() => ({ items, globalDiscount, status: "SELLING", editingSaleId: saleId })),

  setEditingSaleId: (id) => set(() => ({ editingSaleId: id })),

  // As vendas em espera continuam gravadas de propósito: elas são do balcão,
  // não da sessão, e é justamente o que se espera ao trocar de operador.
  clearSession: () =>
    set(() => ({
      status: "IDLE",
      items: [],
      globalDiscount: 0,
      consumer: EMPTY_CONSUMER,
      editingSaleId: null,
      saleClientReference: null,
    })),

  getSubtotal: () =>
    get().items.reduce((total, item) => total + (item.price - item.discount) * item.quantity, 0),

  getTotal: () => Math.max(0, get().getSubtotal() - get().globalDiscount),
}));

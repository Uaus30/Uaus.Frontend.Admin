import { create } from "zustand";

export interface PdvItem {
  id: string;
  productId: string;
  name: string;
  barcode?: string;
  price: number;
  quantity: number;
  discount: number;
}

export type PaymentMethod = "PIX" | "CREDIT_CARD" | "DEBIT_CARD" | "CASH";

export interface CompletedSale {
  id: string;
  timestamp: string;
  items: PdvItem[];
  subtotal: number;
  globalDiscount: number;
  total: number;
  paymentMethod: PaymentMethod;
  status: "FINALIZED" | "CANCELED";
}

interface PdvState {
  status: "IDLE" | "SELLING" | "CHECKOUT";
  items: PdvItem[];
  globalDiscount: number;
  salesHistory: CompletedSale[];
  theme: "light" | "dark";
  editingSaleId: string | null;
  
  // Actions
  addItem: (item: Omit<PdvItem, "id">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  applyItemDiscount: (id: string, discount: number) => void;
  applyGlobalDiscount: (discount: number) => void;
  setCheckout: () => void;
  backToSelling: () => void;
  cancelSale: () => void;
  finishSale: () => void;
  
  // New actions
  setTheme: (theme: "light" | "dark") => void;
  addCompletedSale: (sale: Omit<CompletedSale, "id" | "timestamp" | "status">) => void;
  cancelSaleFromHistory: (id: string) => void;
  updateSaleInHistory: (id: string, items: PdvItem[], globalDiscount: number, paymentMethod: PaymentMethod) => void;
  clearSession: () => void;
  setEditingSaleId: (id: string | null) => void;
  
  // Computed
  getSubtotal: () => number;
  getTotal: () => number;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// Immediately apply theme on module load to avoid FOUC (flash of unstyled content)
const initialTheme = (localStorage.getItem("pdv-theme") as "light" | "dark") || "dark";
if (typeof window !== "undefined") {
  if (initialTheme === "light") {
    document.documentElement.classList.add("light");
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
    document.documentElement.classList.remove("light");
  }
}

export const usePdvStore = create<PdvState>((set, get) => ({
  status: "IDLE",
  items: [],
  globalDiscount: 0,
  editingSaleId: null,
  theme: initialTheme,
  
  // Initial pre-populated sales history for a richer user experience
  salesHistory: [
    {
      id: "VND-1002",
      timestamp: new Date(Date.now() - 3600000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      items: [
        { id: "mock-1", productId: "1002", name: "Detergente Líquido 500ml", price: 2.99, quantity: 2, discount: 0, barcode: "7891000120023" }
      ],
      subtotal: 5.98,
      globalDiscount: 0.98,
      total: 5.00,
      paymentMethod: "DEBIT_CARD",
      status: "FINALIZED"
    },
    {
      id: "VND-1001",
      timestamp: new Date(Date.now() - 7200000).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      items: [
        { id: "mock-2", productId: "1001", name: "Sabonete Barra 90g", price: 1.80, quantity: 5, discount: 0.80, barcode: "7891000120016" },
        { id: "mock-3", productId: "1003", name: "Creme Dental 90g", price: 3.50, quantity: 1, discount: 0, barcode: "7891000120030" }
      ],
      subtotal: 12.50,
      globalDiscount: 0,
      total: 11.70,
      paymentMethod: "PIX",
      status: "FINALIZED"
    }
  ],

  addItem: (item) =>
    set((state) => {
      const existingItem = state.items.find(
        (i) => i.productId === item.productId && i.price === item.price
      );

      if (existingItem) {
        return {
          status: "SELLING",
          items: state.items.map((i) =>
            i.id === existingItem.id
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
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
      const newItems = state.items.filter((i) => i.id !== id);
      return {
        items: newItems,
        status: newItems.length === 0 ? "IDLE" : state.status,
      };
    }),

  updateQuantity: (id, quantity) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
    })),

  applyItemDiscount: (id, discount) =>
    set((state) => ({
      items: state.items.map((i) => (i.id === id ? { ...i, discount } : i)),
    })),

  applyGlobalDiscount: (discount) =>
    set(() => ({
      globalDiscount: discount,
    })),

  setCheckout: () =>
    set((state) => ({
      status: state.items.length > 0 ? "CHECKOUT" : "IDLE",
    })),
    
  backToSelling: () =>
    set((state) => ({
      status: state.items.length > 0 ? "SELLING" : "IDLE",
    })),

  cancelSale: () =>
    set(() => ({
      status: "IDLE",
      items: [],
      globalDiscount: 0,
      editingSaleId: null,
    })),

  finishSale: () =>
    set(() => ({
      status: "IDLE",
      items: [],
      globalDiscount: 0,
      editingSaleId: null,
    })),
    
  setTheme: (theme) => {
    localStorage.setItem("pdv-theme", theme);
    if (typeof window !== "undefined") {
      if (theme === "light") {
        document.documentElement.classList.add("light");
        document.documentElement.classList.remove("dark");
      } else {
        document.documentElement.classList.add("dark");
        document.documentElement.classList.remove("light");
      }
    }
    set(() => ({ theme }));
  },

  addCompletedSale: (sale) =>
    set((state) => {
      const nextId = `VND-${1001 + state.salesHistory.length}`;
      const newSale: CompletedSale = {
        ...sale,
        id: nextId,
        timestamp: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        status: "FINALIZED",
      };
      return {
        salesHistory: [newSale, ...state.salesHistory],
      };
    }),

  cancelSaleFromHistory: (id) =>
    set((state) => ({
      salesHistory: state.salesHistory.map((sale) =>
        sale.id === id ? { ...sale, status: "CANCELED" } : sale
      ),
    })),

  updateSaleInHistory: (id, items, globalDiscount, paymentMethod) =>
    set((state) => {
      const subtotal = items.reduce(
        (acc, item) => acc + (item.price - item.discount) * item.quantity,
        0
      );
      const total = Math.max(0, subtotal - globalDiscount);
      return {
        salesHistory: state.salesHistory.map((sale) =>
          sale.id === id
            ? { ...sale, items, subtotal, globalDiscount, total, paymentMethod }
            : sale
        ),
      };
    }),

  clearSession: () =>
    set(() => ({
      status: "IDLE",
      items: [],
      globalDiscount: 0,
      salesHistory: [],
      editingSaleId: null,
    })),

  setEditingSaleId: (id) =>
    set(() => ({
      editingSaleId: id,
    })),

  getSubtotal: () => {
    const state = get();
    return state.items.reduce(
      (total, item) => total + (item.price - item.discount) * item.quantity,
      0
    );
  },

  getTotal: () => {
    const state = get();
    const subtotal = state.getSubtotal();
    return Math.max(0, subtotal - state.globalDiscount);
  },
}));


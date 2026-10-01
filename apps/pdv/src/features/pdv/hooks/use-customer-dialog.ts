import { create } from "zustand";

/** Atalho do botão Cliente do carrinho. F4 é o cupom; F2 não tem uso no navegador. */
export const CUSTOMER_SHORTCUT_KEY = "F2";

/** O diálogo abre na busca; "Cadastrar" troca para o cadastro rápido. */
export type CustomerDialogMode = "search" | "register";

/**
 * Estado do diálogo de cliente (01/10/2026), num store como o do cupom: ele é
 * aberto pelo carrinho, pelo checkout e pelo atalho de teclado, componentes que
 * não se enxergam.
 */
export const useCustomerDialog = create<{
  open: boolean;
  mode: CustomerDialogMode;
  setOpen: (open: boolean) => void;
  setMode: (mode: CustomerDialogMode) => void;
  /** Abre o diálogo — é o que o botão Cliente e o F2 chamam. */
  show: (mode?: CustomerDialogMode) => void;
}>((set) => ({
  open: false,
  mode: "search",
  setOpen: (open) => set(() => ({ open })),
  setMode: (mode) => set(() => ({ mode })),
  show: (mode = "search") => set(() => ({ open: true, mode })),
}));

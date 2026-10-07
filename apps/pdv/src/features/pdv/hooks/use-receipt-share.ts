import { create } from "zustand";
import type { ReceiptData } from "@workspace/receipt";

/** O comprovante à espera de ser mandado, e para quem. */
export interface ReceiptShareRequest {
  receipt: ReceiptData;
  /** Telefone do cliente da venda, quando o carrinho tinha um. */
  customerPhone: string | null;
}

interface ReceiptShareState {
  request: ReceiptShareRequest | null;
  show: (receipt: ReceiptData, customerPhone?: string | null) => void;
  close: () => void;
}

/**
 * O comprovante que o celular vai mandar pelo WhatsApp (07/10/2026).
 *
 * Store, e não estado de um componente: quem pede o comprovante são três
 * lugares (o fim da venda, o cartão digital da fidelidade e a reimpressão do
 * histórico), todos pelo `useReceiptPrinter`, e o diálogo que mostra é um só,
 * montado em `PdvDialogs` — o mesmo desenho do cartão fidelidade.
 */
export const useReceiptShare = create<ReceiptShareState>((set) => ({
  request: null,
  show: (receipt, customerPhone = null) => set({ request: { receipt, customerPhone } }),
  close: () => set({ request: null }),
}));

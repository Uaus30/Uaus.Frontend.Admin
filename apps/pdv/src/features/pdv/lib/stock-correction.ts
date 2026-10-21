import { create } from "zustand";
import { adminBaseUrl, adminStockCorrectionUrl, openInNewTab } from "@/lib/admin-links";

/**
 * O atalho "Corrigir estoque" do balcão (fase 3 do plano de 14/10/2026).
 *
 * O caixa recusa o produto zerado ("sem estoque") e a quantidade acima do saldo
 * ("estoque insuficiente"). Quando a recusa é do SISTEMA — a mercadoria está na
 * mão do cliente —, o operador não tinha saída ali. O atalho abre o produto no
 * admin, na aba Estoque, na variação recusada e com a contagem aberta (ver
 * `adminStockCorrectionUrl`). O caixa NUNCA consome lote de outra variação para
 * vender: o dono recusou isso como "gambiarra, brecha para bug" (14/10/2026).
 *
 * O admin abre em outra aba, e a correção acontece lá. Por isso o atalho anota o
 * produto aqui: quando o PDV volta a ficar visível, quem relê o saldo é
 * `useStockCorrectionReturn`.
 */

/** O produto recusado, no mínimo que a releitura precisa para achá-lo de novo. */
export type StockCorrectionTarget = {
  id: number;
  name: string;
  barcode?: string | null;
};

/**
 * Por quanto tempo o produto continua sendo relido a cada volta ao PDV.
 *
 * Uma volta só não basta: a pessoa abre o admin, volta ao caixa para conferir o
 * código, e só então registra a contagem. Meia hora cobre essa ida e vinda sem
 * deixar o PDV relendo para sempre um produto que ninguém corrigiu.
 */
export const STOCK_CORRECTION_WATCH_MS = 30 * 60 * 1000;

type PendingCorrection = StockCorrectionTarget & { since: number };

type StockCorrectionState = {
  /** Produtos com correção aberta no admin, por id. */
  pending: Record<number, PendingCorrection>;
  watch: (target: StockCorrectionTarget, now?: number) => void;
  /** Para de reler: o saldo voltou, ou a anotação venceu. */
  forget: (ids: number[]) => void;
};

export const useStockCorrectionStore = create<StockCorrectionState>((set) => ({
  pending: {},
  watch: (target, now = Date.now()) =>
    set((state) => ({ pending: { ...state.pending, [target.id]: { ...target, since: now } } })),
  forget: (ids) =>
    set((state) => {
      const pending = { ...state.pending };
      for (const id of ids) delete pending[id];
      return { pending };
    }),
}));

/**
 * Os produtos a reler agora. As anotações vencidas saem da lista no caminho.
 *
 * @param now Relógio; parâmetro para o teste não depender da hora.
 */
export function takeStockCorrectionsToRefresh(now = Date.now()): StockCorrectionTarget[] {
  const { pending, forget } = useStockCorrectionStore.getState();
  const vencidas = Object.values(pending)
    .filter((item) => now - item.since > STOCK_CORRECTION_WATCH_MS)
    .map((item) => item.id);
  if (vencidas.length > 0) forget(vencidas);

  return Object.values(useStockCorrectionStore.getState().pending).map(({ id, name, barcode }) => ({
    id,
    name,
    barcode,
  }));
}

/**
 * O atalho pode aparecer? Precisa de internet — o admin não abre sem ela, e a
 * sobra da contagem vira lote com custo no servidor — e de saber onde o admin
 * está (`adminBaseUrl`): sem isso o link abriria outra aba do próprio PDV.
 */
export function canCorrectStock(online: boolean): boolean {
  return online && adminBaseUrl() !== null;
}

/** Abre a correção no admin e anota o produto para reler o saldo na volta. */
export function openStockCorrection(target: StockCorrectionTarget): void {
  const url = adminStockCorrectionUrl(target);
  if (url === null) return;

  useStockCorrectionStore.getState().watch(target);
  openInNewTab(url);
}

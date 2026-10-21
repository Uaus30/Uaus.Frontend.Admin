import { useEffect, useRef } from "react";
import { searchPdvProducts } from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { refreshLocalStock } from "@/offline";
import { usePdvStore } from "@/stores/use-pdv-store";
import {
  takeStockCorrectionsToRefresh,
  useStockCorrectionStore,
  type StockCorrectionTarget,
} from "../lib/stock-correction";

/** O saldo que o servidor tem agora de um produto anotado pelo atalho. */
export type FreshStock = { productId: number; name: string; stock: number };

export interface UseStockCorrectionReturnParams {
  /** A API está respondendo. Offline não há o que reler: fica para a próxima volta. */
  online: boolean;
  /** Chamado com os saldos novos, depois de o carrinho e a base local receberem. */
  onRefreshed?: (fresh: FreshStock[]) => void;
}

/** Quantos resultados pedir: o código de barras é único, mas o nome pode não ser. */
const LOOKUP_LIMIT = 20;

/**
 * A volta do "Corrigir estoque": relê o saldo dos produtos anotados pelo atalho
 * quando o PDV volta a ficar visível (fase 3 do plano de 14/10/2026).
 *
 * A correção acontece em outra aba, no admin, e o PDV não tem como saber quando
 * ela termina. O sinal é a pessoa VOLTAR: `visibilitychange` (trocou de aba, ou
 * voltou do navegador para o app instalado no celular) e `focus` (outra janela,
 * no balcão com dois monitores). Na volta, o saldo novo vai para:
 *
 * - **a linha do carrinho** (`refreshAvailableStock`), senão o "+" continuaria
 *   recusando com o saldo de quando o item entrou;
 * - **a base local** (`refreshLocalStock`), senão a primeira queda de internet
 *   voltaria a recusar o produto com a prateleira cheia;
 * - **a lista da busca**, por quem chama (`onRefreshed`), senão a linha ficaria
 *   "Sem estoque" até a pessoa buscar de novo.
 *
 * O produto que voltou com saldo sai da anotação e ganha um aviso; o que segue
 * zerado continua anotado, para a próxima volta (ver `STOCK_CORRECTION_WATCH_MS`).
 */
export function useStockCorrectionReturn({ online, onRefreshed }: UseStockCorrectionReturnParams) {
  const { toast } = useToast();
  const onlineRef = useRef(online);
  const onRefreshedRef = useRef(onRefreshed);
  useEffect(() => {
    onlineRef.current = online;
    onRefreshedRef.current = onRefreshed;
  });

  useEffect(() => {
    /** `focus` e `visibilitychange` chegam juntos na mesma volta: uma releitura basta. */
    let relendo = false;

    async function reler() {
      if (relendo || document.visibilityState !== "visible" || !onlineRef.current) return;
      const alvos = takeStockCorrectionsToRefresh();
      if (alvos.length === 0) return;

      relendo = true;
      try {
        const fresh = (await Promise.all(alvos.map(lerSaldo))).filter(
          (item): item is FreshStock => item !== null,
        );
        if (fresh.length === 0) return;

        const saldos = fresh.map(({ productId, stock }) => ({ productId, stock }));
        usePdvStore.getState().refreshAvailableStock(saldos);
        // Sem base local (caixa que nunca baixou o snapshot) não há o que acertar.
        await refreshLocalStock(saldos).catch(() => undefined);
        onRefreshedRef.current?.(fresh);

        const corrigidos = fresh.filter((item) => item.stock > 0);
        if (corrigidos.length === 0) return;
        useStockCorrectionStore.getState().forget(corrigidos.map((item) => item.productId));
        toast({
          title: "Estoque atualizado",
          description: corrigidos.map((item) => `${item.name}: ${item.stock} no estoque.`).join(" "),
          duration: 4000,
        });
      } finally {
        relendo = false;
      }
    }

    const aoVoltar = () => void reler();
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [toast]);
}

/**
 * O saldo de agora do produto, pela mesma busca do balcão. Pelo código de barras
 * quando há (é único); pelo nome, senão. `null` quando a rede falhou ou o
 * produto não veio — ele continua anotado para a próxima volta.
 */
async function lerSaldo(alvo: StockCorrectionTarget): Promise<FreshStock | null> {
  const termo = alvo.barcode?.trim() || alvo.name;
  try {
    const achados = await searchPdvProducts(termo, LOOKUP_LIMIT);
    const produto = achados.find((item) => item.id === alvo.id);
    return produto ? { productId: produto.id, name: produto.name, stock: produto.stock } : null;
  } catch {
    return null;
  }
}

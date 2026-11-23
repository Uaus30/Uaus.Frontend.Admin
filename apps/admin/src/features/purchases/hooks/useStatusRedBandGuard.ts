import { useRef, useState } from "react";
import { getPurchaseBudget, PURCHASE_STATUS, type PurchaseDto } from "@workspace/api-client-react";
import { purchaseBandImpact, purchaseMoneyValue } from "../lib/purchase-band-impact";

/** A troca de situação que espera a resposta da pergunta do vermelho. */
export interface PendingStatusChange {
  id: number;
  status: number;
  /** Mês da data da compra, `"yyyy-MM"` — é dele que a pergunta fala. */
  monthKey: string;
}

/**
 * "Marcar como a caminho" pelo menu da linha, com a mesma pergunta do editor.
 *
 * A Pendente não conta nas compras pagas do mês; ao virar "A caminho", passa a
 * contar pelo total final (ou o bruto). É a transição que a decisão 13 manda
 * perguntar quando leva o mês ao vermelho — e o menu da linha é o caminho mais
 * usado para ela (o recebimento de uma Pendente fica travado até ela ser marcada
 * como a caminho). Sem este guarda, só o editor perguntava.
 *
 * Mesma regra do editor: a faixa avisa, nunca trava. Faixa que falha ou compra
 * que não está na página seguem sem pergunta; outras situações (voltar para
 * Pendente) não mexem no dinheiro do mês e passam direto.
 *
 * @param items As compras da página, de onde sai a data e o valor da linha.
 * @param apply A troca de situação de fato (`usePurchases().setStatus`).
 */
export function useStatusRedBandGuard(
  items: readonly PurchaseDto[],
  apply: (id: number, status: number) => void,
) {
  const [pending, setPending] = useState<PendingStatusChange | null>(null);
  // Um clique duplo no menu não pode abrir duas consultas nem gravar duas vezes.
  const checking = useRef(false);

  async function request(id: number, status: number) {
    const purchase = items.find((item) => item.id === id);
    if (status !== PURCHASE_STATUS.InTransit || !purchase) {
      apply(id, status);
      return;
    }
    if (checking.current) return;
    checking.current = true;

    const monthKey = purchase.purchaseDate.slice(0, 7);
    const value = purchaseMoneyValue(status, purchase.grossTotal, purchase.finalTotal);
    let leadsToRed = false;
    try {
      const budget = await getPurchaseBudget({ month: monthKey });
      // Pendente não contava: o "antes" vale zero naquele mês.
      leadsToRed =
        purchaseBandImpact(budget, { monthKey, value: 0 }, { monthKey, value })?.leadsToRed ?? false;
    } catch {
      // A faixa avisa, nunca trava a gravação.
    } finally {
      checking.current = false;
    }

    if (leadsToRed) setPending({ id, status, monthKey });
    else apply(id, status);
  }

  /**
   * Grava a troca que ficou esperando. Só age com a pergunta de pé: o clique que
   * cai no diálogo durante a animação de saída não grava nada.
   */
  function confirm() {
    if (!pending) return;
    const change = pending;
    setPending(null);
    apply(change.id, change.status);
  }

  function cancel() {
    setPending(null);
  }

  return { request, pending, confirm, cancel };
}

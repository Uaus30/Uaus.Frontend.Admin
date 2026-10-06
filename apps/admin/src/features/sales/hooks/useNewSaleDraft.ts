import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createCompleteSale,
  getGetProductSalesQueryKey,
  getGetSalesQueryKey,
  useGetStockCorrections,
} from "@workspace/api-client-react";
import { useToast } from "@workspace/ui";
import { computeSaleTotals, describeApiError } from "@workspace/core";
import type { ProductSearchOption } from "@/components/product-search-option";
import { CATALOG_KEYS } from "@/hooks/use-catalog";
import { closedPeriodNotice, closedPeriodToast } from "../lib/closed-periods";
import { isSelectableMethod } from "../lib/payment-method-options";
import { isSaleInFuture, isSaleToday, joinSaleWhen, nowSaleWhen, type SaleWhen } from "../lib/sale-when";
import { useClosingFor } from "./useClosingFor";
import { paymentsProblem, usePaymentSplits } from "./usePaymentSplits";

/** Um item do rascunho: o que a busca de produto trouxe, mais quantidade e preço. */
export type DraftItem = {
  productId: number;
  name: string;
  imageUrl?: string | null;
  /** Saldo quando o produto foi escolhido — para avisar antes de o servidor recusar. */
  stock: number;
  unitPrice: number;
  quantity: number;
};

/**
 * O rascunho da Nova venda do painel (refeito em 06/10/2026, pedido do dono: "hoje
 * está muito ruim e difícil de lançar venda pelo Admin", e ele lança pelo celular).
 *
 * - **Produto pela busca do servidor** (a mesma da compra), e não um select com o
 *   catálogo inteiro — que eram oito consultas ao abrir a modal e uma lista de
 *   centenas de nomes para rolar no dedo.
 * - **Data e hora da venda**, para lançar a venda de outro dia. Só vai para a API
 *   quando a pessoa mexeu nelas: sem mexer, a venda é "agora" no relógio do
 *   servidor, como sempre foi — e não a hora em que a modal foi aberta.
 * - O total é o mesmo do PDV (`computeSaleTotals`), e o servidor o recalcula.
 */
export function useNewSaleDraft(
  paymentMethods: Array<{ id: number; isActive?: boolean }>,
  onSaved: () => void,
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [when, setWhenState] = useState<SaleWhen>(() => nowSaleWhen());
  const [whenTouched, setWhenTouched] = useState(false);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const totals = useMemo(
    () =>
      computeSaleTotals({
        items: items.map((item) => ({ unitPrice: item.unitPrice, quantity: item.quantity, unitDiscount: 0 })),
        globalDiscount: discount,
      }),
    [items, discount],
  );
  const splits = usePaymentSplits(totals.total, paymentMethods);
  // Data em mês com fechamento: permitido, com aviso (decisão do dono, 06/10/2026).
  const closing = useClosingFor()(when.date);

  // Produto contado depois da data escolhida: aviso no próprio item (decisão do
  // dono, 06/10/2026). Só com a data mexida — "agora" não tem contagem depois.
  const { data: corrections } = useGetStockCorrections(
    items.map((item) => item.productId),
    whenTouched ? joinSaleWhen(when) : null,
  );
  const stockCorrections = useMemo(
    () => Object.fromEntries((corrections ?? []).map((item) => [item.productId, item.lastCorrectedAt])),
    [corrections],
  );

  function reset() {
    setWhenState(nowSaleWhen());
    setWhenTouched(false);
    setCustomerId(null);
    setItems([]);
    setDiscount(0);
    setNotes("");
    // A primeira ATIVA em ordem de nome: a lista da API traz as desativadas junto.
    const first = paymentMethods.find(isSelectableMethod);
    splits.setPayments(first ? [{ paymentMethodId: first.id, amount: 0 }] : []);
  }

  function setWhen(next: SaleWhen) {
    setWhenState(next);
    setWhenTouched(true);
  }

  /** Mesmo produto de novo soma uma unidade na linha que já existe. */
  function addProduct(option: ProductSearchOption) {
    setItems((current) => {
      const existing = current.find((item) => item.productId === option.id);
      if (existing) {
        return current.map((item) =>
          item.productId === option.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...current,
        {
          productId: option.id,
          name: option.name,
          imageUrl: option.imageUrl,
          stock: option.stock,
          unitPrice: option.price,
          quantity: 1,
        },
      ];
    });
  }

  function updateItem(productId: number, patch: Partial<Pick<DraftItem, "quantity" | "unitPrice">>) {
    setItems((current) =>
      current.map((item) => (item.productId === productId ? { ...item, ...patch } : item)),
    );
  }

  function removeItem(productId: number) {
    setItems((current) => current.filter((item) => item.productId !== productId));
  }

  /** O primeiro problema que impede gravar, na frase que a tela mostra. */
  function problem(): string | null {
    if (items.length === 0) return "Adicione pelo menos um produto.";
    if (items.some((item) => item.quantity <= 0)) return "Toda quantidade precisa ser maior que zero.";
    if (isSaleInFuture(when)) return "A data da venda não pode ser no futuro.";
    return paymentsProblem(splits.payments, totals.total, splits.remainingAmount);
  }

  async function submit() {
    const recusa = problem();
    if (recusa) {
      toast({ title: "Não dá para registrar ainda", description: recusa, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await createCompleteSale({
        customerId,
        discount,
        notes: notes.trim() || null,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        payments: splits.payments,
        occurredAt: whenTouched ? joinSaleWhen(when) : null,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetSalesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: getGetProductSalesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.customers }),
      ]);
      toast({ title: "Venda registrada.", description: closing ? closedPeriodToast(closing) : undefined });
      onSaved();
    } catch (error) {
      toast({
        title: "Erro ao registrar a venda",
        description: describeApiError(error, "Tente novamente."),
        error,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return {
    when,
    setWhen,
    isBackdated: !isSaleToday(when),
    closedPeriodNotice: closing ? closedPeriodNotice(closing) : null,
    /** Produto → quando o estoque dele foi corrigido por contagem DEPOIS da data da venda. */
    stockCorrections: stockCorrections as Record<number, string>,
    customerId,
    setCustomerId,
    items,
    addProduct,
    updateItem,
    removeItem,
    discount,
    setDiscount,
    notes,
    setNotes,
    subtotal: totals.subtotal,
    total: totals.total,
    ...splits,
    saving,
    reset,
    submit,
  };
}

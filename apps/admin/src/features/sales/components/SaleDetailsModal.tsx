import React from "react";
import { Loader2, Printer, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Badge } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { computeSaleDiscountTotal, formatCurrency, formatDate, round2 } from "@workspace/core";
import { useGetSaleDetails } from "@workspace/api-client-react";
import type { EnrichedSale } from "../types";

type SaleDetailsModalProps = {
  /** Visibility status of the modal */
  open: boolean;
  /** Callback triggered when visibility status changes */
  onOpenChange: (open: boolean) => void;
  /** The enriched sale object to view, or null */
  saleToView: EnrichedSale | null;
  /** Map of payment methods names */
  paymentMethodById: Record<number, string>;
  /** Callback to reprint the receipt of the sale being viewed */
  onPrintReceipt: (id: number) => void;
  /** Active sale ID having its receipt printed, or null */
  printingSaleId: number | null;
};

/**
 * Um item da venda no recorte que o modal lê, seja qual for a origem: o detalhe
 * da API (`SaleItemDto`) ou a lista enriquecida da tela (`EnrichedSale`).
 * Estrutural de propósito, para o modal não ter que escolher entre os dois
 * tipos — nem cair no `any` que escolhia por ele.
 */
type SaleDetailsItem = {
  id: number;
  productId: number;
  productName?: string | null;
  product?: { name?: string | null } | null;
  quantity: number;
  /** Preço unitário praticado, já líquido do desconto e já com o acréscimo do item. */
  unitPrice: number;
  /**
   * Desconto unitário do item, em reais; o preço de tabela era
   * `unitPrice + discount − surcharge`.
   */
  discount?: number | null;
  /**
   * Acréscimo unitário do item — o serviço cobrado junto do produto. Já está
   * dentro de `unitPrice`.
   */
  surcharge?: number | null;
  /** Justificativa do acréscimo, como o operador a escreveu no balcão. */
  surchargeReason?: string | null;
  subtotal: number;
  unitCost?: number | null;
  totalCost?: number | null;
};

/** Uma forma de pagamento da venda, das duas origens. */
type SaleDetailsPayment = {
  id: number;
  paymentMethodId: number;
  paymentMethodName?: string | null;
  amount: number | null;
};

/**
 * SaleDetailsModal
 *
 * Dialog component showing purchase details and transaction aggregates.
 */
export function SaleDetailsModal({
  open,
  onOpenChange,
  saleToView,
  paymentMethodById,
  onPrintReceipt,
  printingSaleId,
}: SaleDetailsModalProps) {
  const { data: saleDetails, isLoading: loadingDetails } = useGetSaleDetails(
    open && saleToView?.id ? saleToView.id : undefined,
  );

  const items: SaleDetailsItem[] = saleDetails?.items ?? saleToView?.items ?? [];
  const payments: SaleDetailsPayment[] = saleDetails?.payments ?? saleToView?.payments ?? [];

  /** Subtotal LÍQUIDO: a soma dos itens ao preço praticado. É a base do lucro. */
  const itemsSubtotal = items.reduce((sum, item) => sum + (item.subtotal ?? 0), 0);

  /**
   * Subtotal BRUTO, a preço de tabela. É o que o rodapé mostra: com o desconto
   * de item somado na linha "Desconto", a conta só fecha de cima para baixo se
   * o subtotal for o de antes de qualquer abatimento (22,00 − 2,00 = 20,00).
   */
  const grossSubtotal = round2(
    items.reduce((sum, item) => sum + (item.unitPrice + Math.max(0, item.discount ?? 0)) * item.quantity, 0),
  );

  /**
   * Quanto da venda foi serviço cobrado na linha, e não produto.
   *
   * Sai em linha própria no rodapé porque ele já está dentro do subtotal bruto
   * acima — a linha não soma nem subtrai nada, ela DISCRIMINA. Sem ela, o
   * acréscimo se confunde com preço de produto exatamente como se confundiria se
   * nunca tivesse ganhado coluna.
   */
  const surchargeTotal = round2(
    items.reduce((sum, item) => sum + Math.max(0, item.surcharge ?? 0) * item.quantity, 0),
  );
  const totalCost = items.reduce((sum, item) => sum + (item.totalCost ?? 0), 0);
  const hasCost = items.some((item) => item.totalCost != null);

  /**
   * Tudo o que foi abatido: desconto de item, da venda e cupom. `discount` do
   * cabeçalho sozinho não inclui o desconto de item — ele já saiu do preço
   * gravado — e o modal dizia "sem desconto" para a venda remarcada só no item.
   * É a mesma conta do histórico e do cupom do PDV.
   */
  const discountTotal = computeSaleDiscountTotal({ discount: saleToView?.discount ?? 0, items });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col border-border/50 bg-card sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <Receipt className="h-5 w-5 text-primary" /> Detalhes da Venda #
            {saleToView?.id.toString().padStart(4, "0")}
          </DialogTitle>
        </DialogHeader>
        {saleToView && (
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto py-4 pr-2">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Data</p>
                <p className="mt-1 font-medium">{formatDate(saleToView.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Consumidor</p>
                <p className="mt-1 font-medium">
                  {saleDetails?.customerName ||
                    saleToView.customerName ||
                    saleToView.customer?.name ||
                    "Consumidor Final"}
                </p>
                {(saleDetails?.customerDocument || saleToView.customerDocument) && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {saleDetails?.customerDocument || saleToView.customerDocument}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Operador</p>
                <p className="mt-1 font-medium">
                  {saleDetails?.userName || saleToView.userName || (
                    <span className="text-muted-foreground">Não informado</span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Pagamento</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {payments.length > 0 ? (
                    payments.map((payment) => (
                      <Badge key={payment.id} variant="secondary">
                        {payment.paymentMethodName || paymentMethodById[payment.paymentMethodId] || "—"}
                        {payments.length > 1 && payment.amount != null && (
                          <span className="ml-1 opacity-70">{formatCurrency(payment.amount)}</span>
                        )}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="secondary">
                      {saleToView.paymentMethodName ||
                        (saleToView.paymentMethodId ? paymentMethodById[saleToView.paymentMethodId] : null) ||
                        "Não informado"}
                    </Badge>
                  )}
                </div>
              </div>
              {saleToView.notes && (
                <div className="col-span-2 mt-2 rounded-r border-l-2 border-primary/50 bg-primary/5 py-1 pl-3">
                  <p className="text-xs text-muted-foreground">Observação</p>
                  <p className="italic">{saleToView.notes}</p>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-xl border border-border/50">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2 text-center">Qtd</th>
                    <th className="px-4 py-2 text-right">Unitário</th>
                    <th className="px-4 py-2 text-right">Custo un.</th>
                    <th className="px-4 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingDetails ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                        Nenhum item encontrado nesta venda.
                      </td>
                    </tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {item.productName || item.product?.name || `Produto #${item.productId}`}
                          {/* Âmbar, o "atenção" da casa: a linha tem cobrança
                              além do produto. Nunca cor sozinha — o rótulo e o
                              motivo escrito pelo operador vêm junto, que é o que
                              responde "por que essa venda deu R$ 5,00 a mais". */}
                          {(item.surcharge ?? 0) > 0 && (
                            <p className="text-[11px] text-amber-500">
                              + {formatCurrency(round2((item.surcharge ?? 0) * item.quantity))} ·{" "}
                              {item.surchargeReason || "Acréscimo sem justificativa"}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">
                          {formatCurrency(item.unitPrice)}
                          {/* Preço de tabela riscado quando houve desconto no item: é o
                              mesmo sinal que o carrinho do PDV dá, e sem ele o desconto
                              do rodapé não teria de onde ter vindo. */}
                          {(item.discount ?? 0) > 0 && (
                            <p className="text-[11px] text-muted-foreground line-through">
                              {formatCurrency(round2(item.unitPrice + (item.discount ?? 0)))}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {item.unitCost != null ? formatCurrency(item.unitCost) : "—"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-background/50 p-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal Itens</span>
                {/* Sem os itens em mãos (detalhe ainda carregando), o único
                    desconto conhecido é o do cabeçalho — e a conta fecha do
                    mesmo jeito: total + cabeçalho − cabeçalho. */}
                <span>
                  {formatCurrency(items.length > 0 ? grossSubtotal : saleToView.total + saleToView.discount)}
                </span>
              </div>
              {/* DISCRIMINA, não soma: o acréscimo já está dentro do subtotal
                  logo acima. Por isso "dos quais" e não um "+" — um sinal ali
                  faria a coluna deixar de fechar de cima para baixo. */}
              {surchargeTotal > 0 && (
                <div className="flex justify-between text-amber-500">
                  <span>dos quais acréscimo em itens</span>
                  <span>{formatCurrency(surchargeTotal)}</span>
                </div>
              )}
              {discountTotal > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Desconto</span>
                  <span>-{formatCurrency(discountTotal)}</span>
                </div>
              )}
              {hasCost && items.length > 0 && (
                <>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Custo dos itens</span>
                    <span>{formatCurrency(totalCost)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Lucro</span>
                    <span>{formatCurrency(itemsSubtotal - totalCost)}</span>
                  </div>
                </>
              )}
              <div className="mt-1 flex justify-between border-t border-border/50 pt-2 text-lg font-bold text-primary">
                <span>Total</span>
                <span>{formatCurrency(saleToView.total)}</span>
              </div>
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            disabled={!saleToView || printingSaleId === saleToView.id}
            onClick={() => saleToView && onPrintReceipt(saleToView.id)}
          >
            {saleToView && printingSaleId === saleToView.id ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            Imprimir cupom
          </Button>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import React from "react";
import { Loader2, Printer, Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Badge } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { formatCurrency, formatDate } from "@workspace/core";
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

  const items = saleDetails?.items ?? saleToView?.items ?? [];
  const payments = saleDetails?.payments ?? saleToView?.payments ?? [];

  const itemsSubtotal = items.reduce((sum: number, item: any) => sum + (item.subtotal ?? 0), 0);
  const totalCost = items.reduce((sum: number, item: any) => sum + (item.totalCost ?? 0), 0);
  const hasCost = items.some((item: any) => item.totalCost != null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/50 bg-card sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <Receipt className="h-5 w-5 text-primary" /> Detalhes da Venda #
            {saleToView?.id.toString().padStart(4, "0")}
          </DialogTitle>
        </DialogHeader>
        {saleToView && (
          <div className="space-y-6 py-4">
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
                    payments.map((payment: any) => (
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
                    items.map((item: any) => (
                      <tr key={item.id} className="border-b border-border/50 last:border-0">
                        <td className="px-4 py-3 font-medium">
                          {item.productName || item.product?.name || `Produto #${item.productId}`}
                        </td>
                        <td className="px-4 py-3 text-center">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
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
                <span>
                  {formatCurrency(items.length > 0 ? itemsSubtotal : saleToView.total + saleToView.discount)}
                </span>
              </div>
              {saleToView.discount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Desconto</span>
                  <span>-{formatCurrency(saleToView.discount)}</span>
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

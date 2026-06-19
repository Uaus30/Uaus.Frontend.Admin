import React from "react";
import { Receipt } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
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
}: SaleDetailsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/50 bg-card sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <Receipt className="h-5 w-5 text-primary" /> Detalhes da Venda #{saleToView?.id.toString().padStart(4, "0")}
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
                <p className="text-xs font-semibold uppercase text-muted-foreground">Cliente</p>
                <p className="mt-1 font-medium">{saleToView.customer?.name || "Consumidor Final"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">Pagamento</p>
                <Badge variant="secondary" className="mt-1">
                  {paymentMethodById[saleToView.paymentMethod] ?? saleToView.paymentMethod}
                </Badge>
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
                    <th className="px-4 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {saleToView.items.map((item) => (
                    <tr key={item.id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 font-medium">{item.product?.name || `Produto #${item.productId}`}</td>
                      <td className="px-4 py-3 text-center">
                        {item.quantity} x {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-background/50 p-4 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal Itens</span>
                <span>{formatCurrency(saleToView.total + saleToView.discount)}</span>
              </div>
              {saleToView.discount > 0 && (
                <div className="flex justify-between text-destructive">
                  <span>Desconto</span>
                  <span>-{formatCurrency(saleToView.discount)}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between border-t border-border/50 pt-2 text-lg font-bold text-primary">
                <span>Total</span>
                <span>{formatCurrency(saleToView.total)}</span>
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import React from "react";
import { Loader2, Receipt, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type { NewSaleDraftItem } from "../types";

type NewSaleModalProps = {
  /** Visibility status of the modal */
  open: boolean;
  /** Callback triggered when visibility status changes */
  onOpenChange: (open: boolean) => void;
  /** Selected customer ID or null for walk-in */
  customerId: number | null;
  /** Callback to update customer ID */
  setCustomerId: (id: number | null) => void;
  /** List of customer options */
  customers: any[];
  /** List of available products in stock */
  availableProducts: any[];
  /** Selected product ID draft */
  selectedProductId: number | "";
  /** Callback to update selected product ID */
  setSelectedProductId: (val: number | "") => void;
  /** Selected quantity draft */
  selectedQty: number;
  /** Callback to update selected quantity draft */
  setSelectedQty: (qty: number) => void;
  /** List of items draft currently in the cart */
  items: NewSaleDraftItem[];
  /** Selected payment method ID string */
  paymentMethod: string;
  /** Callback to update payment method ID */
  setPaymentMethod: (val: string) => void;
  /** Selected payment status ID string */
  paymentStatus: string;
  /** Callback to update payment status ID */
  setPaymentStatus: (val: string) => void;
  /** Payment method options list */
  paymentMethods: any[];
  /** Payment status options list */
  paymentStatuses: any[];
  /** Cash discount amount in Reais (R$) */
  discount: number;
  /** Callback to update cash discount amount */
  setDiscount: (val: number) => void;
  /** Internal transaction notes */
  notes: string;
  /** Callback to update internal transaction notes */
  setNotes: (val: string) => void;
  /** True if request is saving to API */
  savingSale: boolean;
  /** Subtotal sum of items */
  subtotal: number;
  /** Total value to pay (subtotal - discount) */
  total: number;
  /** Callback to add item to local cart */
  onAddItem: () => void;
  /** Callback to remove item from local cart */
  onRemoveItem: (productId: number) => void;
  /** Callback triggered on checkout submit */
  onSubmit: (event: React.FormEvent) => void;
};

/**
 * NewSaleModal
 * 
 * Dialog wizard component supporting live items additions, pay methods, and billing details.
 */
export function NewSaleModal({
  open,
  onOpenChange,
  customerId,
  setCustomerId,
  customers,
  availableProducts,
  selectedProductId,
  setSelectedProductId,
  selectedQty,
  setSelectedQty,
  items,
  paymentMethod,
  setPaymentMethod,
  paymentStatus,
  setPaymentStatus,
  paymentMethods,
  paymentStatuses,
  discount,
  setDiscount,
  notes,
  setNotes,
  savingSale,
  subtotal,
  total,
  onAddItem,
  onRemoveItem,
  onSubmit,
}: NewSaleModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="flex max-h-[90vh] flex-col border-border/50 bg-card sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <Receipt className="h-5 w-5 text-primary" /> Registrar Nova Venda
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 space-y-6 overflow-y-auto py-4 pr-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Cliente (Opcional)</label>
            <Select
              value={customerId?.toString() || "null"}
              onValueChange={(value) => setCustomerId(value === "null" ? null : Number(value))}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Consumidor Final" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="null">Consumidor Final</SelectItem>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id.toString()}>
                    {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4 rounded-xl border border-border/50 bg-background/50 p-4">
            <h4 className="text-sm font-semibold">Itens da Venda</h4>
            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Produto</label>
                <Select
                  value={selectedProductId.toString()}
                  onValueChange={(value) => setSelectedProductId(Number(value))}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Selecione um produto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id.toString()}>
                        {product.name} - {formatCurrency(product.price)} (Estoque: {product.stock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-24 space-y-1">
                <label className="text-xs text-muted-foreground">Qtd</label>
                <Input
                  type="number"
                  min="1"
                  value={selectedQty}
                  onChange={(event) => setSelectedQty(Number(event.target.value))}
                  className="bg-background"
                />
              </div>
              <Button type="button" onClick={onAddItem} variant="secondary" className="hover-elevate">
                Adicionar
              </Button>
            </div>

            {items.length > 0 && (
              <div className="mt-4 overflow-hidden rounded-lg border border-border/50 bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border/50 bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">Qtd</th>
                      <th className="px-3 py-2">Unitário</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                      <th className="w-10 px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const product = availableProducts.find((entry) => entry.id === item.productId);
                      return (
                        <tr key={item.productId} className="border-b border-border/50 last:border-0">
                          <td className="px-3 py-2">{product?.name || `Produto #${item.productId}`}</td>
                          <td className="px-3 py-2">{item.quantity}</td>
                          <td className="px-3 py-2">{formatCurrency(item.unitPrice)}</td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.productId)}
                              className="text-destructive hover:opacity-70"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Método de Pagamento</label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods
                    .filter((option) => option.allowSelect)
                    .map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status do Pagamento</label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {paymentStatuses
                    .filter((option) => option.allowSelect)
                    .map((option) => (
                      <SelectItem key={option.id} value={String(option.id)}>
                        {option.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Desconto (R$)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={discount}
                onChange={(event) => setDiscount(Number(event.target.value))}
                className="bg-background"
              />
            </div>
            <div className="col-span-2 space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="bg-background"
                placeholder="Anotações internas..."
              />
            </div>
          </div>
        </div>
        <div className="mt-auto border-t border-border/50 px-2 pt-4">
          <div className="mb-4 flex items-end justify-between">
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>Subtotal: {formatCurrency(subtotal)}</p>
              <p>Desconto: -{formatCurrency(discount)}</p>
            </div>
            <div className="text-right">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">Total a Pagar</p>
              <p className="text-3xl font-display font-bold text-primary">{formatCurrency(total)}</p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={onSubmit}
              disabled={savingSale || items.length === 0}
              className="hover-elevate"
            >
              {savingSale ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Receipt className="mr-2 h-4 w-4" />
              )}
              Finalizar Venda
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

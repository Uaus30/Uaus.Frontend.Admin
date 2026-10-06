import React from "react";
import { Loader2, Receipt } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import { blockImplicitSubmit } from "@/lib/block-implicit-submit";
import type { useNewSaleDraft } from "../hooks/useNewSaleDraft";
import type { PaymentMethodOption } from "../lib/payment-method-options";
import { SALE_DIALOG_BODY } from "../lib/sale-dialog";
import { BACKDATED_SALE_NOTICE } from "../lib/sale-when";
import { CustomerPicker } from "./CustomerPicker";
import { SaleItemsEditor } from "./SaleItemsEditor";
import { SalePaymentsEditor } from "./SalePaymentsEditor";
import { SaleWhenField } from "./SaleWhenField";

type NewSaleModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ReturnType<typeof useNewSaleDraft>;
  customers: Array<{ id: number; name: string; document?: string | null; phone?: string | null }>;
  paymentMethods: PaymentMethodOption[];
};

/**
 * Nova venda pelo painel — refeita em 06/10/2026 para o celular, onde o dono
 * lança venda ("hoje está muito ruim e difícil de lançar venda pelo Admin").
 *
 * Na ordem de quem lança: quando foi (para a venda de outro dia), quem comprou,
 * o que levou, desconto e observação, como pagou. O total e o "Registrar venda"
 * ficam num rodapé que não rola — no celular o diálogo é a tela inteira e o corpo
 * rola por dentro, com os botões sempre à mão.
 */
export function NewSaleModal({ open, onOpenChange, draft, customers, paymentMethods }: NewSaleModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 border-border/50 bg-card p-0 sm:max-w-[640px]">
        <DialogHeader className="border-b border-border/40 px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Receipt className="h-5 w-5 text-primary" /> Nova venda
          </DialogTitle>
          <DialogDescription>O estoque baixa dos lotes de hoje, pelo mais antigo.</DialogDescription>
        </DialogHeader>

        <form
          id="new-sale-form"
          onSubmit={(event) => {
            event.preventDefault();
            void draft.submit();
          }}
          onKeyDown={blockImplicitSubmit}
          className={SALE_DIALOG_BODY}
        >
          <SaleWhenField
            value={draft.when}
            onChange={draft.setWhen}
            notices={[draft.isBackdated ? BACKDATED_SALE_NOTICE : null, draft.closedPeriodNotice]}
          />

          <div className="space-y-2">
            <span className="text-sm font-medium">Cliente</span>
            <CustomerPicker customers={customers} value={draft.customerId} onChange={draft.setCustomerId} />
          </div>

          <SaleItemsEditor
            items={draft.items}
            onAdd={draft.addProduct}
            onUpdate={draft.updateItem}
            onRemove={draft.removeItem}
            stockCorrections={draft.stockCorrections}
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
            <div className="space-y-2">
              <label htmlFor="new-sale-discount" className="text-sm font-medium">
                Desconto
              </label>
              <CurrencyInput
                id="new-sale-discount"
                value={draft.discount}
                onChange={draft.setDiscount}
                className="h-10 bg-background"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="new-sale-notes" className="text-sm font-medium">
                Observação
              </label>
              <Textarea
                id="new-sale-notes"
                value={draft.notes}
                onChange={(event) => draft.setNotes(event.target.value)}
                placeholder="Ex.: encomenda, troca, venda pelo WhatsApp..."
                className="min-h-10 bg-background"
              />
            </div>
          </div>

          <SalePaymentsEditor
            payments={draft.payments}
            methods={paymentMethods}
            remainingAmount={draft.remainingAmount}
            onAdd={draft.addPayment}
            onRemove={draft.removePayment}
            onUpdate={draft.updatePayment}
          />
        </form>

        <div className="flex flex-col gap-3 border-t border-border/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <div className="text-sm">
            {draft.discount > 0 && (
              <p className="text-xs text-muted-foreground">
                {formatCurrency(draft.subtotal)} − {formatCurrency(draft.discount)} de desconto
              </p>
            )}
            <p className="text-lg font-bold text-primary">Total {formatCurrency(draft.total)}</p>
          </div>
          <div className="flex gap-2 max-sm:[&>button]:flex-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={draft.saving}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="new-sale-form"
              disabled={draft.saving}
              className="bg-primary text-primary-foreground"
            >
              {draft.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registrar venda
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

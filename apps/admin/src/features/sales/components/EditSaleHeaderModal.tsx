import React from "react";
import { Loader2, Pencil } from "lucide-react";
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
import type { SaleDto } from "@workspace/api-client-react";
import { blockImplicitSubmit } from "@/lib/block-implicit-submit";
import { useEditSaleHeader } from "../hooks/useEditSaleHeader";
import type { PaymentMethodOption } from "../lib/payment-method-options";
import { REDATED_SALE_NOTICE } from "../lib/sale-when";
import { CustomerPicker } from "./CustomerPicker";
import { SalePaymentsEditor } from "./SalePaymentsEditor";
import { SaleWhenField } from "./SaleWhenField";

type EditSaleHeaderModalProps = {
  /** A venda a corrigir; nulo fecha a modal. */
  sale: SaleDto | null;
  onClose: () => void;
  customers: Array<{ id: number; name: string; document?: string | null; phone?: string | null }>;
  paymentMethods: PaymentMethodOption[];
};

/**
 * Corrigir a venda já registrada: data, cliente, observação e formas de pagamento
 * (06/10/2026). Itens e total não mudam aqui — está escrito na tela, para
 * ninguém procurar onde trocar o produto.
 */
export function EditSaleHeaderModal({ sale, onClose, customers, paymentMethods }: EditSaleHeaderModalProps) {
  return (
    <Dialog open={sale !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 border-border/50 bg-card p-0 sm:max-w-[560px]">
        {/* `key` da venda: outra venda é outro formulário, que nasce do que está
            gravado — sem efeito copiando a venda para o estado. */}
        {sale && (
          <EditSaleHeaderForm
            key={sale.id}
            sale={sale}
            onClose={onClose}
            customers={customers}
            paymentMethods={paymentMethods}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditSaleHeaderForm({
  sale,
  onClose,
  customers,
  paymentMethods,
}: Omit<EditSaleHeaderModalProps, "sale"> & { sale: SaleDto }) {
  const edit = useEditSaleHeader(sale, paymentMethods, onClose);
  const numero = `#${sale.id.toString().padStart(4, "0")}`;

  return (
    <>
      <DialogHeader className="border-b border-border/40 px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
        <DialogTitle className="flex items-center gap-2 font-display text-xl">
          <Pencil className="h-5 w-5 text-primary" /> Corrigir a venda {numero}
        </DialogTitle>
        <DialogDescription>
          Total {formatCurrency(edit.total)}. Itens e valores não mudam aqui — para trocar um produto, cancele
          a venda e lance de novo.
        </DialogDescription>
      </DialogHeader>

      <form
        id="edit-sale-form"
        onSubmit={(event) => {
          event.preventDefault();
          void edit.submit();
        }}
        onKeyDown={blockImplicitSubmit}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6"
      >
        <SaleWhenField
          value={edit.when}
          onChange={edit.setWhen}
          notice={edit.dateChanged ? REDATED_SALE_NOTICE : null}
        />

        <div className="space-y-2">
          <span className="text-sm font-medium">Cliente</span>
          <CustomerPicker customers={customers} value={edit.customerId} onChange={edit.setCustomerId} />
        </div>

        <div className="space-y-2">
          <label htmlFor="edit-sale-notes" className="text-sm font-medium">
            Observação
          </label>
          <Textarea
            id="edit-sale-notes"
            value={edit.notes}
            onChange={(event) => edit.setNotes(event.target.value)}
            className="min-h-10 bg-background"
          />
        </div>

        <SalePaymentsEditor
          payments={edit.payments}
          methods={paymentMethods}
          remainingAmount={edit.remainingAmount}
          onAdd={edit.addPayment}
          onRemove={edit.removePayment}
          onUpdate={edit.updatePayment}
        />
      </form>

      <div className="flex gap-2 border-t border-border/40 px-4 py-3 sm:justify-end sm:px-6 sm:py-4 max-sm:[&>button]:flex-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={edit.saving}>
          Cancelar
        </Button>
        <Button type="submit" form="edit-sale-form" disabled={edit.saving}>
          {edit.saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar correção
        </Button>
      </div>
    </>
  );
}

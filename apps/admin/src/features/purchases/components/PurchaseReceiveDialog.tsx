import { PackageCheck } from "lucide-react";
import { Button, Input, Textarea } from "@workspace/ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui";
import { DatePicker, formatDateInput, guardCalendarDismiss, parseDateInput } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import { PricingPreview } from "@/features/stock-entries/components/PricingPreview";
import type { PurchaseDto, ReceiveForm } from "../types";

type PurchaseReceiveDialogProps = {
  purchase: PurchaseDto | null;
  form: ReceiveForm;
  onChange: <K extends keyof ReceiveForm>(field: K, value: ReceiveForm[K]) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isSaving: boolean;
};

/**
 * Recebimento de compra com produto JÁ cadastrado.
 *
 * Quantidade e custo vêm da compra e não se editam aqui — mudar o que chegou é
 * editar a compra antes de receber. O diálogo pede só o que a compra não
 * sabe: a data da entrada, o número da nota e o preço de venda (em branco
 * mantém o do cadastro). A prévia de margem usa o custo unitário FINAL, que é
 * o que a entrada vai gravar.
 */
export function PurchaseReceiveDialog({
  purchase,
  form,
  onChange,
  onCancel,
  onConfirm,
  isSaving,
}: PurchaseReceiveDialogProps) {
  return (
    <Dialog open={purchase !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="max-h-[90vh] max-w-2xl overflow-y-auto"
        onInteractOutside={guardCalendarDismiss}
        onFocusOutside={guardCalendarDismiss}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <PackageCheck className="h-5 w-5 text-emerald-600" />
            Lançar recebimento
          </DialogTitle>
          <DialogDescription>
            A entrada de estoque é gravada com a quantidade e o custo desta compra, e a compra passa a
            Lançado.
          </DialogDescription>
        </DialogHeader>

        {purchase && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            className="mt-2 flex flex-col gap-5"
          >
            <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-sm">
              <p className="font-semibold text-foreground">{purchase.productName}</p>
              <p className="text-xs text-muted-foreground">
                {purchase.supplierName} · {purchase.quantity} un. · custo unitário{" "}
                <span className="font-semibold text-foreground">{formatCurrency(purchase.unitFinal)}</span> ·
                total {formatCurrency(purchase.finalTotal)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Data da entrada <span className="text-red-500">*</span>
                </label>
                <DatePicker
                  value={parseDateInput(form.entryDate)}
                  onChange={(date) => onChange("entryDate", formatDateInput(date))}
                  placeholder="Selecionar data"
                  clearable={false}
                  maxDate={new Date()}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">Nº da nota</label>
                <Input
                  value={form.invoiceNumber}
                  onChange={(event) => onChange("invoiceNumber", event.target.value)}
                  placeholder="Ex: NF-1234"
                  className="h-10 bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Preço de venda
                </label>
                <CurrencyInput
                  value={form.price}
                  onChange={(value) => onChange("price", value)}
                  className="h-10 bg-background"
                />
                <p className="text-xs text-muted-foreground">
                  Em branco (zero) mantém o preço atual do cadastro.
                </p>
              </div>
            </div>

            <PricingPreview
              unitCost={purchase.unitFinal}
              price={form.price}
              onApplySuggested={(price) => onChange("price", price)}
            />

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Observações</label>
              <Textarea
                value={form.notes}
                onChange={(event) => onChange("notes", event.target.value)}
                className="min-h-16"
              />
            </div>

            <div className="mt-2 flex items-center justify-end gap-2 border-t border-border/40 pt-4">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                disabled={isSaving}
              >
                {isSaving ? "Lançando..." : "Confirmar recebimento"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

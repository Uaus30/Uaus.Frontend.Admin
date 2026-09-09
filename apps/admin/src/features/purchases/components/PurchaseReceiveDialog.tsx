import { AlertTriangle, PackageCheck, Pencil } from "lucide-react";
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
  /** Leva ao formulário da compra — o caminho quando ela foi anotada sem custo. */
  onEditPurchase: (purchase: PurchaseDto) => void;
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
 *
 * Compra anotada SEM custo (pendente) não se recebe daqui: a entrada gravaria o
 * lote a custo zero em silêncio. O diálogo diz isso e troca o botão de confirmar
 * por "Editar compra" — o backend recusa de qualquer jeito
 * (`PurchaseRules.EnsureCostInformed`), mas um botão que só devolve erro é pior
 * que um que leva ao lugar certo.
 */
export function PurchaseReceiveDialog({
  purchase,
  form,
  onChange,
  onCancel,
  onConfirm,
  onEditPurchase,
  isSaving,
}: PurchaseReceiveDialogProps) {
  const missingCost = purchase !== null && purchase.finalTotal <= 0;

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
              if (missingCost) return;
              onConfirm();
            }}
            className="mt-2 flex flex-col gap-5"
          >
            <div className="rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-sm">
              <p className="font-semibold text-foreground">{purchase.productName}</p>
              <p className="text-xs text-muted-foreground">
                {purchase.supplierName} · {purchase.quantity} un. ·{" "}
                {missingCost ? (
                  <span className="font-semibold text-amber-500">sem custo informado</span>
                ) : (
                  <>
                    custo unitário{" "}
                    <span className="font-semibold text-foreground">
                      {formatCurrency(purchase.unitFinal)}
                    </span>{" "}
                    · total {formatCurrency(purchase.finalTotal)}
                  </>
                )}
              </p>
            </div>

            {missingCost && (
              <div
                data-testid="receive-missing-cost"
                className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-500"
              >
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Esta compra foi anotada sem custo. A entrada de estoque grava o custo unitário daqui — edite
                  a compra e informe o total final antes de lançar o recebimento.
                </span>
              </div>
            )}

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
                <label className="text-xs font-semibold uppercase text-muted-foreground">
                  Nº da Nota Fiscal
                </label>
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
                  {purchase.suggestedPrice
                    ? "Veio do preço sugerido na compra. Em branco (zero) mantém o preço atual."
                    : "Em branco (zero) mantém o preço atual do cadastro."}
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
              {missingCost ? (
                <Button type="button" onClick={() => onEditPurchase(purchase)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar compra
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  disabled={isSaving}
                >
                  {isSaving ? "Lançando..." : "Confirmar recebimento"}
                </Button>
              )}
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

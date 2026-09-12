import { AlertTriangle, PackageCheck, Pencil } from "lucide-react";
import { Button, Input, Textarea } from "@workspace/ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui";
import { DatePicker, formatDateInput, guardCalendarDismiss, parseDateInput } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import { PricingPreview } from "@/features/stock-entries/components/PricingPreview";
import { PurchaseReceiveGrid } from "./PurchaseReceiveGrid";
import type { PurchaseDto, PurchaseFormItem, ReceiveForm } from "../types";

type PurchaseReceiveDialogProps = {
  purchase: PurchaseDto | null;
  form: ReceiveForm;
  onChange: <K extends keyof ReceiveForm>(field: K, value: ReceiveForm[K]) => void;
  /** Ajuste de uma variação na conferência. */
  onItemChange: (productId: number, campo: "quantity" | "finalTotal", valor: number) => void;
  /** Variação que veio e não estava no pedido. */
  onAddItem: (item: PurchaseFormItem) => void;
  onCancel: () => void;
  onConfirm: () => void;
  /** Leva ao formulário da compra — o caminho quando ela foi anotada sem custo. */
  onEditPurchase: (purchase: PurchaseDto) => void;
  isSaving: boolean;
};

/**
 * Recebimento de compra com produto JÁ cadastrado — que é também a CONFERÊNCIA.
 *
 * Em compra de um produto só, quantidade e custo vêm da compra e não se editam:
 * o diálogo pede o que a compra não sabe — data da entrada, número da nota e
 * preço de venda (em branco mantém o do cadastro).
 *
 * Em compra com VARIAÇÕES a grade aparece editável (12/09/2026). Quem compra
 * caixa sortida registra a grade no chute — não dá para saber as cores antes de
 * abrir a embalagem — e só aqui sabe o que veio. O que se ajusta é a
 * DISTRIBUIÇÃO, não o valor pago; enquanto a soma não fechar com o total da
 * compra, o confirmar fica desabilitado.
 *
 * A prévia de margem usa o custo unitário FINAL, que é o que a entrada grava.
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
  onItemChange,
  onAddItem,
  onCancel,
  onConfirm,
  onEditPurchase,
  isSaving,
}: PurchaseReceiveDialogProps) {
  const missingCost = purchase !== null && purchase.finalTotal <= 0;
  // Com uma variação só não há conferência a fazer: o que foi pedido é o que
  // chegou, e a grade seria uma tabela de uma linha para não decidir nada.
  const conferindo = form.items.length > 1;
  const somaDaGrade =
    Math.round(
      form.items.filter((item) => item.quantity > 0).reduce((total, item) => total + item.finalTotal, 0) *
        100,
    ) / 100;
  const gradeFecha = !conferindo || somaDaGrade === form.finalTotal;

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
              if (missingCost || !gradeFecha) return;
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

            {conferindo && (
              <PurchaseReceiveGrid
                items={form.items}
                finalTotal={form.finalTotal}
                onItemChange={onItemChange}
                onAddVariation={onAddItem}
                onUseSum={(soma) => onChange("finalTotal", soma)}
              />
            )}

            {/* Substituir é destrutivo e o recebimento é a última chance de mudar
                de ideia — por isso a escolha gravada na compra reaparece aqui. */}
            {purchase.images.length > 0 && (
              <label className="flex items-start gap-2.5 rounded-lg border border-border/40 bg-muted/20 px-3.5 py-3 text-xs leading-relaxed">
                <input
                  type="checkbox"
                  className="mt-0.5 h-3.5 w-3.5"
                  checked={form.replaceProductImages}
                  onChange={(event) => onChange("replaceProductImages", event.target.checked)}
                />
                <span className="text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Substituir as fotos do produto pelas desta compra
                  </span>
                  <br />
                  Desmarcado, as {purchase.images.length} foto(s) da compra entram como principais e as que o
                  produto já tem descem de posição. A imagem nunca é apagada do catálogo.
                </span>
              </label>
            )}

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
                  disabled={isSaving || !gradeFecha}
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

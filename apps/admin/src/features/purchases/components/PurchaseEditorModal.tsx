import { Lock, Package, ShoppingCart, X } from "lucide-react";
import { Button, Input, Textarea } from "@workspace/ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { DatePicker, formatDateInput, guardCalendarDismiss, parseDateInput } from "@workspace/ui";
import { PURCHASE_STATUS, type SupplierDto } from "@workspace/api-client-react";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import { PricingPreview } from "@/features/stock-entries/components/PricingPreview";
import { ProductSearchPicker } from "@/components/product-search-picker";
import { derivePurchaseTotals } from "../lib/purchase-totals";
import { PurchaseDerivedTotals } from "./PurchaseDerivedTotals";
import { PurchaseImagesField } from "./PurchaseImagesField";
import { PurchaseLinkField } from "./PurchaseLinkField";
import type { usePurchaseForm } from "../hooks/usePurchaseForm";

type PurchaseEditorModalProps = {
  form: ReturnType<typeof usePurchaseForm>;
  suppliers: SupplierDto[];
};

/**
 * Formulário da compra.
 *
 * O produto é opcional de propósito: a compra costuma ser de algo que ainda
 * não está no cadastro. Sem produto vinculado, nome, detalhes, fotos e link
 * viram o pré-cadastro que o recebimento abre preenchido. Com produto, o nome
 * é o do cadastro e fica travado — duas grafias do mesmo item confundiriam
 * mais do que ajudam.
 *
 * Só os TOTAIS são digitados. Unitários e percentual saem da conta na hora
 * (`derivePurchaseTotals`) e são gravados pelo backend com a mesma fórmula.
 *
 * A colagem de foto (Ctrl+V) é escutada pelo DIÁLOGO inteiro, e não por uma
 * área de arrastar: o atalho existe para poupar o clique, e obrigar a acertar
 * um alvo antes de colar devolveria o clique que ele economiza. Quem cola
 * dentro de um campo de texto continua colando texto — o handler se afasta.
 */
export function PurchaseEditorModal({ form, suppliers }: PurchaseEditorModalProps) {
  const { form: values, update, readOnly, linkRequired } = form;
  const derived = derivePurchaseTotals(values.quantity, values.grossTotal, values.finalTotal);

  return (
    <Dialog open={form.open} onOpenChange={form.setOpen}>
      <DialogContent
        className="max-h-[90vh] max-w-3xl overflow-y-auto"
        onPaste={readOnly ? undefined : form.handlePaste}
        onInteractOutside={guardCalendarDismiss}
        onFocusOutside={guardCalendarDismiss}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ShoppingCart className="h-5 w-5 text-primary" />
            {readOnly ? "Compra lançada" : form.editingId ? "Editar compra" : "Registrar compra"}
          </DialogTitle>
          <DialogDescription>
            Um produto por compra. O recebimento vira uma entrada de estoque com a quantidade e o custo daqui.
          </DialogDescription>
        </DialogHeader>

        {readOnly && (
          <div className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Esta compra já foi lançada no estoque e não pode mais ser alterada — a entrada existe, e mudar
              quantidade ou valor aqui deixaria os dois documentos discordando. Para corrigir, edite a entrada
              de estoque correspondente.
            </span>
          </div>
        )}

        <form onSubmit={form.submit} className="mt-2 flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Fornecedor <span className="text-red-500">*</span>
              </label>
              <Select
                value={values.supplierId}
                onValueChange={(value) => update("supplierId", value)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Selecione um fornecedor..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={String(supplier.id)}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Data da compra <span className="text-red-500">*</span>
              </label>
              {/* Nasce hoje e é editável: o pedido costuma ser lançado no sistema
                  depois de fechado, e a data do extrato é a que interessa. Não é
                  a data da ENTRADA, que o recebimento pergunta à parte. */}
              <DatePicker
                value={parseDateInput(values.purchaseDate)}
                onChange={(date) => update("purchaseDate", formatDateInput(date))}
                placeholder="Selecionar data"
                clearable={false}
                maxDate={new Date()}
                disabled={readOnly}
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Situação</label>
              <Select
                value={values.status}
                onValueChange={(value) => update("status", value)}
                disabled={readOnly}
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={String(PURCHASE_STATUS.Pending)}>Pendente</SelectItem>
                  <SelectItem value={String(PURCHASE_STATUS.InTransit)}>A caminho</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Produto já cadastrado (opcional)
            </label>
            {values.productId === null ? (
              <ProductSearchPicker
                onSelect={form.selectProduct}
                selectedIds={[]}
                disabled={form.isSaving || readOnly}
                placeholder="Buscar produto por nome ou código de barras — ou deixe em branco para produto novo"
              />
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Package className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{values.productName}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {values.productBarcode || "Sem código de barras"}
                    </p>
                  </div>
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={form.clearProduct}
                    aria-label="Desvincular produto"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {values.productId === null && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Nome do produto <span className="text-red-500">*</span>
              </label>
              <Input
                value={values.productName}
                onChange={(event) => update("productName", event.target.value)}
                placeholder="Como vai se chamar no cadastro"
                className="h-10 bg-background"
                maxLength={150}
                readOnly={readOnly}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Quantidade <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                step="1"
                value={values.quantity}
                onChange={(event) => {
                  const parsed = Number(event.target.value);
                  update("quantity", Number.isFinite(parsed) ? parsed : 0);
                }}
                aria-label="Quantidade comprada"
                className="h-10 bg-background"
                readOnly={readOnly}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Total bruto</label>
              {/* `allowFormula`: a nota do fornecedor vem em "12 a 17,99", e a conta
                  digitada no campo deixa o total conferível. Ver `evaluateAmountFormula`. */}
              <CurrencyInput
                value={values.grossTotal}
                onChange={(value) => update("grossTotal", value)}
                className="h-10 bg-background"
                readOnly={readOnly}
                allowFormula
              />
              <p className="text-xs text-muted-foreground">
                Aceita conta: <span className="font-mono">=17,99*2</span>
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Total final</label>
              <CurrencyInput
                value={values.finalTotal}
                onChange={(value) => update("finalTotal", value)}
                className="h-10 bg-background"
                readOnly={readOnly}
                allowFormula
              />
              <p className="text-xs text-muted-foreground">Já com desconto ou acréscimo (frete).</p>
            </div>
          </div>

          <PurchaseDerivedTotals derived={derived} />

          {/* O preço de venda decidido na hora de COMPRAR: é aqui que se olha para
              o custo, e é aqui que a conta de margem ainda pode mudar a decisão de
              comprar. No recebimento ele já vem preenchido e passa a valer no
              cadastro do produto. */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Preço sugerido de venda
              </label>
              <CurrencyInput
                value={values.suggestedPrice}
                onChange={(value) => update("suggestedPrice", value)}
                className="h-10 bg-background"
                readOnly={readOnly}
                allowFormula
              />
              <p className="text-xs text-muted-foreground">
                Em branco (zero) mantém o preço atual do produto no recebimento.
              </p>
            </div>
            <div className="md:col-span-2">
              <PricingPreview
                unitCost={derived.unitFinal}
                price={values.suggestedPrice}
                onApplySuggested={(price) => update("suggestedPrice", price)}
                readOnly={readOnly}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Detalhes</label>
              <Textarea
                value={values.details}
                onChange={(event) => update("details", event.target.value)}
                placeholder="Cor, tamanho, referência do fornecedor..."
                className="min-h-16"
                readOnly={readOnly}
              />
            </div>
            <PurchaseLinkField
              value={values.purchaseLink}
              onChange={(value) => update("purchaseLink", value)}
              required={linkRequired}
              supplierName={form.supplier?.name}
              readOnly={readOnly}
            />
          </div>

          <PurchaseImagesField
            images={values.images}
            readOnly={readOnly}
            uploading={form.uploading}
            productName={values.productName}
            onFileSelection={form.handleFileSelection}
            onAddUrl={form.addImageFromUrl}
            onRemove={form.removeImage}
            onSearchWeb={() => form.setImageSearchOpen(true)}
          />

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-border/40 pt-4">
            <Button type="button" variant="outline" onClick={() => form.setOpen(false)}>
              {readOnly ? "Fechar" : "Cancelar"}
            </Button>
            {!readOnly && (
              <Button
                type="submit"
                className="bg-primary text-primary-foreground"
                disabled={form.isSaving || form.uploading}
              >
                {form.isSaving ? "Salvando..." : form.editingId ? "Salvar alterações" : "Registrar compra"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { Globe, ImagePlus, Loader2, Package, ShoppingCart, X } from "lucide-react";
import { Button, Input, Textarea } from "@workspace/ui";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { PURCHASE_STATUS, type SupplierDto } from "@workspace/api-client-react";
import { formatCurrency, formatPercentage } from "@workspace/core";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import { ProductSearchPicker } from "@/components/product-search-picker";
import { derivePurchaseTotals } from "../lib/purchase-totals";
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
 */
export function PurchaseEditorModal({ form, suppliers }: PurchaseEditorModalProps) {
  const { form: values, update } = form;
  const derived = derivePurchaseTotals(values.quantity, values.grossTotal, values.finalTotal);

  return (
    <Dialog open={form.open} onOpenChange={form.setOpen}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ShoppingCart className="h-5 w-5 text-primary" />
            {form.editingId ? "Editar compra" : "Registrar compra"}
          </DialogTitle>
          <DialogDescription>
            Um produto por compra. O recebimento vira uma entrada de estoque com a quantidade e o custo daqui.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.submit} className="mt-2 flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Fornecedor <span className="text-red-500">*</span>
              </label>
              <Select value={values.supplierId} onValueChange={(value) => update("supplierId", value)}>
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
              <label className="text-xs font-semibold uppercase text-muted-foreground">Situação</label>
              <Select value={values.status} onValueChange={(value) => update("status", value)}>
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
                disabled={form.isSaving}
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
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Total bruto</label>
              <CurrencyInput
                value={values.grossTotal}
                onChange={(value) => update("grossTotal", value)}
                className="h-10 bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Total final (com desconto/acréscimo)
              </label>
              <CurrencyInput
                value={values.finalTotal}
                onChange={(value) => update("finalTotal", value)}
                className="h-10 bg-background"
              />
            </div>
          </div>

          <div
            data-testid="purchase-derived"
            className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-xs text-muted-foreground"
          >
            <span>
              Unitário bruto:{" "}
              <span className="font-semibold text-foreground">{formatCurrency(derived.unitGross)}</span>
            </span>
            <span>
              Unitário final:{" "}
              <span className="font-semibold text-foreground">{formatCurrency(derived.unitFinal)}</span>
            </span>
            <span>
              {derived.adjustmentPercent < 0 ? "Desconto" : "Acréscimo"}:{" "}
              <span
                className={`font-semibold ${
                  derived.adjustmentPercent < 0
                    ? "text-emerald-600"
                    : derived.adjustmentPercent > 0
                      ? "text-amber-600"
                      : "text-foreground"
                }`}
              >
                {formatPercentage(Math.abs(derived.adjustmentPercent))}
              </span>
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Detalhes</label>
              <Textarea
                value={values.details}
                onChange={(event) => update("details", event.target.value)}
                placeholder="Cor, tamanho, referência do fornecedor..."
                className="min-h-16"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Link da compra</label>
              <Input
                value={values.purchaseLink}
                onChange={(event) => update("purchaseLink", event.target.value)}
                placeholder="https://..."
                className="h-10 bg-background"
                maxLength={500}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Fotos</label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1" asChild>
                  <label className="cursor-pointer">
                    <ImagePlus className="h-3.5 w-3.5" /> Enviar
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={form.handleFileSelection}
                      disabled={form.uploading}
                    />
                  </label>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={form.uploading || !values.productName.trim()}
                  onClick={() => form.setImageSearchOpen(true)}
                  title={
                    values.productName.trim() ? "Buscar foto na web" : "Informe o nome do produto para buscar"
                  }
                >
                  <Globe className="h-3.5 w-3.5" /> Buscar na web
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {values.images.map((image) => (
                <div
                  key={image.imageId}
                  className="relative h-20 w-20 overflow-hidden rounded-lg border border-border/50 bg-white"
                >
                  <img src={image.url} alt={image.name} className="h-full w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => form.removeImage(image.imageId)}
                    aria-label="Remover foto"
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {form.uploading && (
                <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-border/50">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {values.images.length === 0 && !form.uploading && (
                <p className="text-xs text-muted-foreground">
                  Opcional. Em produto novo, as fotos viram a galeria do cadastro no recebimento.
                </p>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-border/40 pt-4">
            <Button type="button" variant="outline" onClick={() => form.setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-primary text-primary-foreground"
              disabled={form.isSaving || form.uploading}
            >
              {form.isSaving ? "Salvando..." : form.editingId ? "Salvar alterações" : "Registrar compra"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

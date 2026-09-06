import React from "react";
import { Package, Receipt, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui";
import { DatePicker } from "@workspace/ui";
import { formatDateInput, guardCalendarDismiss, parseDateInput } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Textarea } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Button } from "@workspace/ui";
import type { SupplierDto } from "@workspace/api-client-react";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import { ProductSearchPicker, type ProductSearchOption } from "@/components/product-search-picker";
import type { EditableEntryItemField } from "../hooks/useStockEntries";
import type { NewEntryItem } from "../types";
import { PricingPreview } from "./PricingPreview";

type NewStockEntryModalProps = {
  /** Visibility status of the modal */
  open: boolean;
  /** Callback triggered when visibility status changes */
  onOpenChange: (open: boolean) => void;
  /** Selected supplier ID string */
  supplierId: string;
  /** Callback to change selected supplier ID */
  setSupplierId: (val: string) => void;
  /** Invoice identifier string */
  invoiceNumber: string;
  /** Callback to change invoice identifier */
  setInvoiceNumber: (val: string) => void;
  /** Receipt date string */
  entryDate: string;
  /** Callback to change receipt date string */
  setEntryDate: (val: string) => void;
  /** Internal textual notes */
  notes: string;
  /** Callback to change internal textual notes */
  setNotes: (val: string) => void;
  /** O produto da entrada, ou `null` enquanto a busca não escolheu um */
  item: NewEntryItem | null;
  /** List of suppliers options */
  suppliers: SupplierDto[];
  /** True if request is actively saving to backend */
  isSavingEntry: boolean;
  /** Coloca o produto escolhido na busca no rascunho */
  onSelectProduct: (product: ProductSearchOption) => void;
  /** Tira o produto do rascunho para escolher outro */
  onClearProduct: () => void;
  /** Atualiza um campo numérico do rascunho */
  onItemChange: (field: EditableEntryItemField, value: number) => void;
  /** Callback triggered on form submission */
  onSubmit: (e: React.FormEvent) => void;
};

/**
 * Registro de entrada de estoque — UM produto por lançamento (31/08/2026).
 *
 * A grade multi-item saiu de cena: cada lançamento é um lote de um produto,
 * conferível de uma olhada, igual à modal da aba Estoque do detalhe do produto.
 * Nota com vários produtos vira vários lançamentos. O produto continua entrando
 * pela busca (`ProductSearchPicker`), que aceita nome e código de barras.
 */
export function NewStockEntryModal({
  open,
  onOpenChange,
  supplierId,
  setSupplierId,
  invoiceNumber,
  setInvoiceNumber,
  entryDate,
  setEntryDate,
  notes,
  setNotes,
  item,
  suppliers,
  isSavingEntry,
  onSelectProduct,
  onClearProduct,
  onItemChange,
  onSubmit,
}: NewStockEntryModalProps) {
  const vendeAbaixoDoCusto =
    item !== null && item.price > 0 && item.unitCost > 0 && item.price < item.unitCost;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        O calendário abre num portal fora do modal; sem as guardas abaixo, o
        Radix trataria o clique num dia como interação externa e fecharia o
        formulário inteiro.
      */}
      <DialogContent
        className="max-w-2xl overflow-y-auto max-h-[90vh]"
        onInteractOutside={guardCalendarDismiss}
        onFocusOutside={guardCalendarDismiss}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Registrar Entrada de Estoque
          </DialogTitle>
          <DialogDescription>
            Um produto por lançamento. Nota com vários produtos vira um lançamento por item.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col gap-5 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Fornecedor <span className="text-red-500">*</span>
              </label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Selecione um fornecedor..." />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Nº da Nota Fiscal
              </label>
              <Input
                placeholder="Ex: NF-1234"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="h-10 bg-background"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Data da Entrada <span className="text-red-500">*</span>
              </label>
              {/*
                Data futura viraria o lote "mais recente" e ditaria o custo do
                produto até lá — o backend recusa, e o calendário nem oferece.
              */}
              <DatePicker
                value={parseDateInput(entryDate)}
                onChange={(date) => setEntryDate(formatDateInput(date))}
                placeholder="Selecionar data"
                clearable={false}
                maxDate={new Date()}
                className="h-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Produto <span className="text-red-500">*</span>
            </label>
            {item === null ? (
              <ProductSearchPicker
                onSelect={onSelectProduct}
                selectedIds={[]}
                disabled={isSavingEntry}
                placeholder="Buscar produto por nome ou código de barras..."
              />
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Package className="h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{item.productName}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {item.barcode || "Sem código de barras"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {item.stock !== null && (
                    <p className="text-xs text-muted-foreground">
                      Estoque:{" "}
                      <span className="font-semibold text-foreground">
                        {item.stock} → {item.stock + (Number.isFinite(item.quantity) ? item.quantity : 0)}
                      </span>
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClearProduct}
                    aria-label="Trocar produto"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          {item !== null && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Quantidade <span className="text-red-500">*</span>
                </label>
                {/*
                  Sem `Math.max` no onChange de propósito: a trava impedia limpar
                  o campo para digitar. Zero e fração são barrados no submit.
                */}
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={item.quantity}
                  onChange={(e) => {
                    const parsed = Number(e.target.value);
                    onItemChange("quantity", Number.isFinite(parsed) ? parsed : 0);
                  }}
                  aria-label="Quantidade recebida"
                  className="h-10 bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Custo Unitário <span className="text-red-500">*</span>
                </label>
                {/*
                  CurrencyInput, e não type=number: é o mesmo campo de moeda com
                  vírgula do resto do admin — o type=number exigia ponto decimal.
                */}
                <CurrencyInput
                  value={item.unitCost}
                  onChange={(val) => onItemChange("unitCost", val)}
                  className="h-10 bg-background"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Preço de Venda <span className="text-red-500">*</span>
                </label>
                <CurrencyInput
                  value={item.price}
                  onChange={(val) => onItemChange("price", val)}
                  className="h-10 bg-background"
                />
                {vendeAbaixoDoCusto && (
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                    Preço abaixo do custo unitário — a margem será negativa.
                  </p>
                )}
              </div>
            </div>
          )}

          {item !== null && (
            <PricingPreview
              unitCost={item.unitCost}
              price={item.price}
              onApplySuggested={(price) => onItemChange("price", price)}
            />
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Observações internas
            </label>
            <Textarea
              placeholder="Informações adicionais como frete, observações físicas..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-16"
            />
          </div>

          <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-2">
            <span className="text-xs text-muted-foreground">
              (*) Campos obrigatórios. O custo e o preço lançados passam a valer no cadastro.
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-primary text-primary-foreground" disabled={isSavingEntry}>
                {isSavingEntry ? "Salvando..." : "Salvar Entrada"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

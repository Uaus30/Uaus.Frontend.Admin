import React from "react";
import { FileText, Receipt, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui";
import { DatePicker } from "@workspace/ui";
import { formatDateInput, guardCalendarDismiss, parseDateInput } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Textarea } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import type { SupplierDto } from "@workspace/api-client-react";
import { ProductSearchPicker, type ProductSearchOption } from "@/components/product-search-picker";
import type { EditableEntryItemField } from "../hooks/useStockEntries";
import { orderStockEntrySuppliers } from "../supplier-order";
import type { NewEntryItem } from "../types";

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
  /** Current items draft list */
  items: NewEntryItem[];
  /** List of suppliers options */
  suppliers: SupplierDto[];
  /** True if request is actively saving to backend */
  isSavingEntry: boolean;
  /** Callback to append the product chosen in the search */
  onAddItem: (product: ProductSearchOption) => void;
  /** Callback to remove item draft row at index */
  onRemoveItem: (index: number) => void;
  /** Callback to update a numeric field on item draft row */
  onItemChange: (index: number, field: EditableEntryItemField, value: number) => void;
  /** Callback triggered on form submission */
  onSubmit: (e: React.FormEvent) => void;
};

/**
 * NewStockEntryModal
 *
 * Form dialog hosting inputs to record new supplier physical stock purchases.
 *
 * O produto entra pela busca (`ProductSearchPicker`), e não por um `Select` com
 * o catálogo inteiro: são mais de mil produtos, e rolar essa lista para achar um
 * item de nota fiscal não é trabalho de operador. A busca aceita nome e código
 * de barras — o mesmo termo que funciona na tela de produtos e no PDV.
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
  items,
  suppliers,
  isSavingEntry,
  onAddItem,
  onRemoveItem,
  onItemChange,
  onSubmit,
}: NewStockEntryModalProps) {
  const selectedIds = items.map((item) => item.productId);
  const orderedSuppliers = orderStockEntrySuppliers(suppliers);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        O calendário abre num portal fora do modal; sem as guardas abaixo, o
        Radix trataria o clique num dia como interação externa e fecharia o
        formulário inteiro.
      */}
      <DialogContent
        className="max-w-4xl overflow-y-auto max-h-[90vh]"
        onInteractOutside={guardCalendarDismiss}
        onFocusOutside={guardCalendarDismiss}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Registrar Entrada de Estoque
          </DialogTitle>
          <DialogDescription>
            Preencha os dados do fornecedor e lance as mercadorias recebidas.
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
                  {orderedSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Nº da Nota Fiscal / Identificador
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
              <DatePicker
                value={parseDateInput(entryDate)}
                onChange={(date) => setEntryDate(formatDateInput(date))}
                placeholder="Selecionar data"
                clearable={false}
                className="h-10"
              />
            </div>
          </div>

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

          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
              <FileText className="h-4 w-4 text-primary" />
              Produtos da Entrada
            </h4>

            <ProductSearchPicker
              onSelect={onAddItem}
              selectedIds={selectedIds}
              disabled={isSavingEntry}
              placeholder="Buscar produto por nome ou código de barras..."
            />

            {items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/40 py-8 text-center text-xs text-muted-foreground">
                Nenhum produto lançado. Use a busca acima para adicionar os itens da nota.
              </p>
            ) : (
              <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/5">
                {/*
                  `table-fixed` com largura declarada por coluna: sem ele o
                  navegador redistribui tudo pelo conteúdo, e o cabeçalho deixa de
                  cair sobre a célula que nomeia. O `whitespace-nowrap` impede que
                  o asterisco de obrigatório quebre para a linha de baixo.
                */}
                <Table className="table-fixed">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="px-3 py-2 text-xs whitespace-nowrap">
                        Produto <span className="text-red-500">*</span>
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs whitespace-nowrap w-36">
                        Cód. Barras
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs whitespace-nowrap text-center w-24">
                        Qtd. <span className="text-red-500">*</span>
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs whitespace-nowrap text-center w-28">
                        Custo Unit. <span className="text-red-500">*</span>
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs whitespace-nowrap text-center w-28">
                        Preço Venda <span className="text-red-500">*</span>
                      </TableHead>
                      <TableHead className="px-3 py-2 text-xs whitespace-nowrap text-center w-16">
                        Remover
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => (
                      <TableRow key={item.productId} className="hover:bg-muted/5">
                        <TableCell className="px-3 py-2 text-xs">
                          <span className="block truncate" title={item.productName}>
                            {item.productName}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2 font-mono text-xs text-muted-foreground">
                          <span className="block truncate">{item.barcode || "-"}</span>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              onItemChange(index, "quantity", Math.max(1, Number(e.target.value)))
                            }
                            aria-label={`Quantidade de ${item.productName}`}
                            className="h-8 text-center text-xs bg-background"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitCost}
                            onChange={(e) =>
                              onItemChange(index, "unitCost", Math.max(0, Number(e.target.value)))
                            }
                            aria-label={`Custo unitário de ${item.productName}`}
                            className="h-8 text-center text-xs bg-background"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.price}
                            onChange={(e) =>
                              onItemChange(index, "price", Math.max(0, Number(e.target.value)))
                            }
                            aria-label={`Preço de venda de ${item.productName}`}
                            className="h-8 text-center text-xs bg-background"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemoveItem(index)}
                            aria-label={`Remover ${item.productName}`}
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-2">
            <span className="text-xs text-muted-foreground">(*) Campos obrigatórios</span>
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

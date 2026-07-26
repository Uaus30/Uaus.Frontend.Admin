import React from "react";
import { FileText, PlusCircle, Receipt, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDateInput, guardCalendarDismiss, parseDateInput } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  suppliers: any[];
  /** List of products options */
  products: any[];
  /** True if request is actively saving to backend */
  isSavingEntry: boolean;
  /** Callback to append an empty item draft row */
  onAddEmptyItem: () => void;
  /** Callback to remove item draft row at index */
  onRemoveItem: (index: number) => void;
  /** Callback to update specific fields on item draft row */
  onItemChange: (index: number, field: keyof NewEntryItem, value: any) => void;
  /** Callback triggered on form submission */
  onSubmit: (e: React.FormEvent) => void;
};

/**
 * NewStockEntryModal
 * 
 * Form dialog hosting inputs to record new supplier physical stock purchases.
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
  products,
  isSavingEntry,
  onAddEmptyItem,
  onRemoveItem,
  onItemChange,
  onSubmit,
}: NewStockEntryModalProps) {
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
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                Produtos da Entrada
              </h4>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddEmptyItem}
                className="gap-1.5 h-8 hover:bg-primary/5 hover:text-primary transition-all duration-200"
              >
                <PlusCircle className="h-4 w-4" /> Adicionar Produto
              </Button>
            </div>

            <div className="border border-border/40 rounded-xl overflow-hidden bg-muted/5">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="px-3 py-2">
                      Produto <span className="text-red-500">*</span>
                    </TableHead>
                    <TableHead className="px-3 py-2 w-28 text-center">
                      Quantidade <span className="text-red-500">*</span>
                    </TableHead>
                    <TableHead className="px-3 py-2 w-32 text-center">
                      Custo Unit. <span className="text-red-500">*</span>
                    </TableHead>
                    <TableHead className="px-3 py-2 w-32 text-center">
                      Preço Venda <span className="text-red-500">*</span>
                    </TableHead>
                    <TableHead className="px-3 py-2 text-right w-16">Remover</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                        Nenhum produto adicionado. Clique em "Adicionar Produto".
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, index) => (
                      <TableRow key={index} className="hover:bg-muted/5">
                        <TableCell className="px-3 py-2">
                          <Select
                            value={item.productId}
                            onValueChange={(val) => onItemChange(index, "productId", val)}
                          >
                            <SelectTrigger className="h-8 text-xs bg-background">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id.toString()} className="text-xs">
                                  {p.name} {p.barcode ? `(${p.barcode})` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              onItemChange(index, "quantity", Math.max(1, Number(e.target.value)))
                            }
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
                            className="h-8 text-center text-xs bg-background"
                          />
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemoveItem(index)}
                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-2">
            <span className="text-xs text-muted-foreground">(*) Campos obrigatórios</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-primary text-primary-foreground"
                disabled={isSavingEntry}
              >
                {isSavingEntry ? "Salvando..." : "Salvar Entrada"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import React from "react";
import { CalendarDays, Receipt, Trash2, Truck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { ConfirmDialog } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import type { StockEntryDetails } from "../types";

type StockEntryDetailsModalProps = {
  /** Visibility status of the modal */
  open: boolean;
  /** Callback to change visibility status */
  onOpenChange: (open: boolean) => void;
  /** ID of the active stock entry */
  selectedEntryId: number | null;
  /** Detail payload object from the API */
  entryDetails: any;
  /** True if details are loading from the API */
  isLoadingDetails: boolean;
  /** Callback to format numeric values as currency (BRL) */
  formatCurrency: (val: number) => string;
  /** Callback to format date strings */
  formatShortDate: (dateStr: string) => string;
  /** Callback to delete/cancel the stock entry by ID */
  onDelete: (payload: { id: number }) => void;
};

/**
 * StockEntryDetailsModal
 * 
 * Dialog component displaying itemized lists of products received in a purchase receipt.
 */
export function StockEntryDetailsModal({
  open,
  onOpenChange,
  selectedEntryId,
  entryDetails,
  isLoadingDetails,
  formatCurrency,
  formatShortDate,
  onDelete,
}: StockEntryDetailsModalProps) {
  // O cancelamento mexe em estoque de verdade — recalcula saldo de produto.
  // A confirmação vira estado para poder ser lida e testada, em vez de um
  // window.confirm que trava a aba enquanto o operador decide.
  const [cancelConfirmOpen, setCancelConfirmOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Detalhes da Entrada #{selectedEntryId}
          </DialogTitle>
          <DialogDescription>Dados da entrada de mercadoria e lista de itens recebidos.</DialogDescription>
        </DialogHeader>

        {isLoadingDetails || !entryDetails ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="flex flex-col gap-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl border border-border/50 bg-muted/20">
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Fornecedor</span>
                <span className="text-sm font-semibold flex items-center gap-1.5" title={entryDetails.supplierName}>
                  <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                  {entryDetails.supplierName}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Data</span>
                <span className="text-sm font-semibold flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatShortDate(entryDetails.entryDate)}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Nota Fiscal</span>
                <span className="text-sm font-semibold font-mono">
                  {entryDetails.invoiceNumber || "Não informada"}
                </span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground block mb-1">Valor Total</span>
                <span className="text-sm font-bold text-emerald-500">
                  {formatCurrency(entryDetails.total)}
                </span>
              </div>
            </div>

            {entryDetails.notes && (
              <div className="p-3 bg-muted/10 rounded-lg border border-border/30">
                <span className="text-xs text-muted-foreground block mb-1">Observações</span>
                <p className="text-sm text-foreground/80">{entryDetails.notes}</p>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Itens Recebidos</h4>
              <div className="border border-border/40 rounded-xl overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="px-4 py-2">Produto</TableHead>
                      <TableHead className="px-4 py-2">Cód. Barras</TableHead>
                      <TableHead className="px-4 py-2 text-right">Qtd.</TableHead>
                      <TableHead className="px-4 py-2 text-right">Custo Unit.</TableHead>
                      <TableHead className="px-4 py-2 text-right">Preço de Venda</TableHead>
                      <TableHead className="px-4 py-2 text-right">Custo Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entryDetails.items.map((item: any) => (
                      <TableRow key={item.id} className="hover:bg-muted/5">
                        <TableCell className="px-4 py-2 text-sm font-medium">{item.productName}</TableCell>
                        <TableCell className="px-4 py-2 text-sm font-mono text-xs">{item.barcode}</TableCell>
                        <TableCell className="px-4 py-2 text-sm font-semibold text-right">{item.quantity}</TableCell>
                        <TableCell className="px-4 py-2 text-sm text-right">{formatCurrency(item.unitCost)}</TableCell>
                        <TableCell className="px-4 py-2 text-sm text-right text-emerald-500 font-semibold">
                          {formatCurrency(item.productPrice)}
                        </TableCell>
                        <TableCell className="px-4 py-2 text-sm text-right font-semibold">
                          {formatCurrency(item.totalCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter className="mt-4 flex items-center justify-between border-t border-border/40 pt-4">
              {entryDetails.canDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  className="gap-2 mr-auto"
                  onClick={() => setCancelConfirmOpen(true)}
                >
                  <Trash2 className="h-4 w-4" /> Cancelar Entrada
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>

            <ConfirmDialog
              open={cancelConfirmOpen}
              onOpenChange={setCancelConfirmOpen}
              title="Cancelar esta entrada de estoque?"
              itemName={`Entrada #${entryDetails.id} — ${entryDetails.supplierName} — ${formatCurrency(entryDetails.total)}`}
              description="Isto removerá os lotes de estoque associados e recalculará o estoque atual dos produtos. Os itens recebidos nesta nota deixam de contar no saldo. A ação não pode ser desfeita."
              confirmLabel="Sim, cancelar entrada"
              destructive
              onConfirm={() => onDelete({ id: entryDetails.id })}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}



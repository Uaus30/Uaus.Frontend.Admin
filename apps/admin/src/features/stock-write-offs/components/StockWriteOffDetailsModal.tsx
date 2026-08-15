import { PackageMinus, RotateCcw } from "lucide-react";
import {
  enumCode,
  STOCK_WRITE_OFF_REASON,
  STOCK_WRITE_OFF_REASON_LABEL,
  STOCK_WRITE_OFF_STATUS,
  type StockWriteOffDto,
} from "@workspace/api-client-react";
import { Badge } from "@workspace/ui";
import { Button } from "@workspace/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { formatCurrency, formatDate, formatQuantity } from "@workspace/core";
import { STOCK_WRITE_OFF_STATUS_LABEL } from "@/services/stock-write-offs.service";
import { isReversibleWriteOff } from "../hooks/useStockWriteOffs";

type StockWriteOffDetailsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  writeOff?: StockWriteOffDto;
  isLoading: boolean;
  /** Abre a confirmação de estorno para esta baixa. */
  onReverse: (writeOff: StockWriteOffDto) => void;
};

/**
 * StockWriteOffDetailsModal
 *
 * Espelho da baixa com os itens que saíram. O custo exibido é o FIFO congelado
 * no momento da baixa, não o custo atual do produto.
 */
export function StockWriteOffDetailsModal({
  open,
  onOpenChange,
  writeOff,
  isLoading,
  onReverse,
}: StockWriteOffDetailsModalProps) {
  const reversed = writeOff ? !isReversibleWriteOff(writeOff) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <PackageMinus className="h-5 w-5 text-primary" />
            Baixa #{writeOff?.id ?? ""}
          </DialogTitle>
          <DialogDescription>
            Saída de mercadoria sem venda. O custo é o do momento da baixa.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !writeOff ? (
          <div className="flex items-center justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 rounded-xl border border-border/50 bg-muted/20 p-4 md:grid-cols-3">
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">Data/Hora</span>
                <span className="text-sm font-semibold">{formatDate(writeOff.occurredAt)}</span>
              </div>
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">Motivo</span>
                <span className="text-sm font-semibold">
                  {STOCK_WRITE_OFF_REASON_LABEL[enumCode(writeOff.reason, STOCK_WRITE_OFF_REASON)] ??
                    "Não informado"}
                </span>
              </div>
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">Situação</span>
                <Badge variant={reversed ? "destructive" : "secondary"} className="font-normal">
                  {STOCK_WRITE_OFF_STATUS_LABEL[enumCode(writeOff.status, STOCK_WRITE_OFF_STATUS)] ??
                    "Não informada"}
                </Badge>
              </div>
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">Registrada por</span>
                <span className="text-sm font-semibold">{writeOff.userName || "Não informado"}</span>
              </div>
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">Quantidade total</span>
                <span className="text-sm font-semibold">{formatQuantity(writeOff.totalQuantity)}</span>
              </div>
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">Custo total</span>
                <span className="text-sm font-bold text-destructive">
                  {formatCurrency(writeOff.totalCost)}
                </span>
              </div>
            </div>

            {writeOff.notes && (
              <div className="rounded-lg border border-border/30 bg-muted/10 p-3">
                <span className="mb-1 block text-xs text-muted-foreground">Observação</span>
                <p className="text-sm text-foreground/80">{writeOff.notes}</p>
              </div>
            )}

            {/* Bloco do estorno: só existe depois que a baixa foi desfeita. */}
            {reversed && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-destructive">
                  <RotateCcw className="h-3.5 w-3.5" /> Estornada
                </span>
                <p className="text-sm text-foreground/80">
                  {writeOff.reversedAt ? formatDate(writeOff.reversedAt) : "Data não informada"}
                  {writeOff.reversedByUserName ? ` por ${writeOff.reversedByUserName}` : ""}
                </p>
                {writeOff.reversalNotes && (
                  <p className="mt-1 text-sm text-foreground/80">Motivo: {writeOff.reversalNotes}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Itens da baixa</h4>
              <div className="overflow-hidden rounded-xl border border-border/40">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="px-4 py-2">Produto</TableHead>
                      <TableHead className="px-4 py-2">Cód. Barras</TableHead>
                      <TableHead className="px-4 py-2 text-right">Qtd.</TableHead>
                      <TableHead className="px-4 py-2 text-right">Custo Unit.</TableHead>
                      <TableHead className="px-4 py-2 text-right">Custo Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {writeOff.items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                          Nenhum item nesta baixa.
                        </TableCell>
                      </TableRow>
                    ) : (
                      writeOff.items.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/5">
                          <TableCell className="px-4 py-2 text-sm font-medium">
                            {item.productName || `Produto #${item.productId}`}
                          </TableCell>
                          <TableCell className="px-4 py-2 font-mono text-xs">
                            {item.barcode || "-"}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right text-sm font-semibold">
                            {formatQuantity(item.quantity)}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right text-sm">
                            {formatCurrency(item.unitCost)}
                          </TableCell>
                          <TableCell className="px-4 py-2 text-right text-sm font-semibold">
                            {formatCurrency(item.totalCost)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <DialogFooter className="mt-2 flex items-center justify-between border-t border-border/40 pt-4">
              {!reversed && (
                <Button
                  type="button"
                  variant="destructive"
                  className="mr-auto gap-2"
                  onClick={() => onReverse(writeOff)}
                >
                  <RotateCcw className="h-4 w-4" /> Estornar baixa
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}



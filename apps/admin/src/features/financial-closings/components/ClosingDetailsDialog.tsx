import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Loader2, Lock, Trash2 } from "lucide-react";
import { formatDate, formatShortDate } from "@/lib/formatters";
import { ClosingSummary } from "./ClosingSummary";
import type { FinancialClosingDto } from "../types";

interface ClosingDetailsDialogProps {
  open: boolean;
  closing: FinancialClosingDto | undefined;
  isLoading: boolean;
  isDeleting: boolean;
  onClose: () => void;
  /** Exclui o fechamento (com confirmação e aviso de registro em log). */
  onDelete: (closing: FinancialClosingDto) => void;
}

/**
 * ClosingDetailsDialog
 *
 * Detalhe de um fechamento confirmado: números congelados, rateio por sócio,
 * observações e autoria. Não há edição — para refazer o período, o caminho é
 * excluir (ação registrada em log) e fechar de novo.
 */
export function ClosingDetailsDialog({
  open,
  closing,
  isLoading,
  isDeleting,
  onClose,
  onDelete,
}: ClosingDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {closing
              ? `Fechamento de ${formatShortDate(closing.periodStart)} — ${formatShortDate(closing.periodEnd)}`
              : "Fechamento Financeiro"}
          </DialogTitle>
          <DialogDescription>
            Números e rateio congelados na confirmação — alterações posteriores em sócios ou
            custos fixos não afetam este documento.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !closing ? (
          <div className="py-12 text-center text-muted-foreground">
            Carregando fechamento...
          </div>
        ) : (
          <>
            <div className="space-y-4 pt-2">
              <ClosingSummary closing={closing} />

              {closing.notes && (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Observações
                  </p>
                  <p className="mt-1 text-sm whitespace-pre-wrap">{closing.notes}</p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Fechado por{" "}
                <span className="font-medium text-foreground">
                  {closing.closedByUserName ?? "—"}
                </span>{" "}
                em {formatDate(closing.createdAt)}.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                variant="destructive"
                onClick={() => onDelete(closing)}
                disabled={isDeleting}
                className="gap-2"
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Excluir fechamento
              </Button>
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}



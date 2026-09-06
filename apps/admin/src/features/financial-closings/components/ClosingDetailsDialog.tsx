import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@workspace/ui";
import { Button } from "@workspace/ui";
import { ConfirmDialog } from "@workspace/ui";
import { Loader2, Lock, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@workspace/core";
import { describePeriod } from "../month-selection";
import { ClosingSummary } from "./ClosingSummary";
import type { FinancialClosingDto } from "../types";

interface ClosingDetailsDialogProps {
  open: boolean;
  closing: FinancialClosingDto | undefined;
  isLoading: boolean;
  isDeleting: boolean;
  onClose: () => void;
  /** Exclui o fechamento. Deve devolver a Promise da mutação — ver o ConfirmDialog. */
  onDelete: (closing: FinancialClosingDto) => void | Promise<unknown>;
}

/**
 * ClosingDetailsDialog
 *
 * Detalhe de um fechamento confirmado: números congelados, rateio por sócio,
 * observações e autoria. Não há edição — para refazer o período, o caminho é
 * excluir (ação registrada em log) e fechar de novo.
 *
 * A confirmação da exclusão mora aqui porque é daqui que ela é disparada, e
 * porque o aviso precisa citar o período e o lucro líquido que estão na tela —
 * é o que separa "excluir um rascunho" de "apagar o documento oficial do mês".
 */
export function ClosingDetailsDialog({
  open,
  closing,
  isLoading,
  isDeleting,
  onClose,
  onDelete,
}: ClosingDetailsDialogProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (val) return;
        // Sem zerar aqui, fechar o detalhe com a confirmação aberta deixaria o
        // pedido de exclusão pendurado, e o próximo fechamento aberto já
        // apareceria com o aviso na tela.
        setConfirmingDelete(false);
        onClose();
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {closing ? `Fechamento de ${describePeriod(closing)}` : "Fechamento Financeiro"}
          </DialogTitle>
          <DialogDescription>
            Números e rateio congelados na confirmação — alterações posteriores em sócios ou custos fixos não
            afetam este documento.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !closing ? (
          <div className="py-12 text-center text-muted-foreground">Carregando fechamento...</div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pt-2 pr-2">
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
                <span className="font-medium text-foreground">{closing.closedByUserName ?? "—"}</span> em{" "}
                {formatDate(closing.createdAt)}.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                variant="destructive"
                onClick={() => setConfirmingDelete(true)}
                disabled={isDeleting}
                className="gap-2"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Excluir fechamento
              </Button>
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </DialogFooter>

            <ConfirmDialog
              open={confirmingDelete}
              onOpenChange={setConfirmingDelete}
              title="Excluir este fechamento financeiro?"
              itemName={`${describePeriod(closing)} · lucro líquido ${formatCurrency(closing.netProfit)}`}
              description="O documento oficial do período some, junto com o rateio congelado entre os sócios. O período volta a ficar livre para um novo fechamento, e um novo cálculo pode dar outro número: ele usa os sócios, percentuais e custos fixos de HOJE. A exclusão fica registrada em log com o seu usuário. A ação não pode ser desfeita."
              confirmLabel="Sim, excluir fechamento"
              destructive
              loading={isDeleting}
              onConfirm={async () => {
                await onDelete(closing);
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

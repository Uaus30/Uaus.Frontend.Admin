import { useState } from "react";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui";
import { Loader2, Lock, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@workspace/core";
import { describePeriod } from "../month-selection";
import { ClosingResultBlock } from "./ClosingResultBlock";
import { ClosingCashBlock } from "./ClosingCashBlock";
import { ClosingSharesBlock } from "./ClosingSharesBlock";
import { VariableCostsTable } from "./VariableCostsTable";
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
 * O documento congelado de um fechamento, nos três blocos: resultado, caixa e
 * rateio com as retiradas. Não há edição — para refazer, exclui-se e fecha-se
 * de novo.
 *
 * **Só o último fechamento pode ser excluído** (corrente de saldos): excluir um
 * do meio deixaria o seguinte com um saldo inicial que não existe mais. O botão
 * só aparece no último; nos outros, a tela diz por quê. A confirmação cita o
 * período e o lucro líquido da tela, e avisa que o mês seguinte volta a aguardar.
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
            Números, rateio, retiradas e saldo congelados na confirmação — alterações posteriores em sócios ou
            custos fixos não afetam este documento.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !closing ? (
          <div className="py-12 text-center text-muted-foreground">Carregando fechamento...</div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 pt-2">
              <ClosingResultBlock closing={closing} />
              <VariableCostsTable items={closing.variableCosts} total={closing.variableCostsTotal} />
              <ClosingCashBlock closing={closing} showConfirmation />
              <ClosingSharesBlock closing={closing} />

              {closing.notes && (
                <div className="rounded-lg border bg-muted/20 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Observações
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{closing.notes}</p>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Fechado por{" "}
                <span className="font-medium text-foreground">{closing.closedByUserName ?? "—"}</span> em{" "}
                {formatDate(closing.createdAt)}.
              </p>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              {closing.isLatest ? (
                <Button
                  variant="destructive"
                  onClick={() => setConfirmingDelete(true)}
                  disabled={isDeleting}
                  className="gap-2"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Excluir fechamento
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground sm:max-w-sm" data-testid="delete-locked">
                  Só o último fechamento pode ser excluído: o saldo deste abre o mês seguinte.
                </p>
              )}
              <Button variant="outline" onClick={onClose}>
                Fechar
              </Button>
            </DialogFooter>

            <ConfirmDialog
              open={confirmingDelete && closing.isLatest}
              onOpenChange={setConfirmingDelete}
              title="Excluir este fechamento financeiro?"
              itemName={`${describePeriod(closing)} · lucro líquido ${formatCurrency(closing.netProfit)}`}
              description="O documento do mês some, junto com o rateio, as retiradas e o saldo confirmado. O mês volta a aguardar fechamento, e o seguinte volta a esperar por ele. Um novo cálculo pode dar outro número: ele usa os sócios, percentuais e custos fixos de HOJE. A exclusão fica registrada em log com o seu usuário. A ação não pode ser desfeita."
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

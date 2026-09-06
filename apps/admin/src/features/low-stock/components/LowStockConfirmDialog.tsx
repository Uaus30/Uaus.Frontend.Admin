import { SlidersHorizontal } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui";
import type { LowStockConfirm } from "../hooks/useLowStock";

type LowStockConfirmDialogProps = {
  confirm: LowStockConfirm | null;
  onCancel: () => void;
  onConfirm: () => void;
  isSaving: boolean;
};

/**
 * A confirmação de "remover o controle de estoque".
 *
 * A ação muda o cadastro do produto e não tem desfazer nesta tela — daí a
 * pergunta. O texto cita o PRODUTO e diz o que vai acontecer com ele: "tem
 * certeza?" sozinho obriga a lembrar em qual linha se clicou.
 */
export function LowStockConfirmDialog({
  confirm,
  onCancel,
  onConfirm,
  isSaving,
}: LowStockConfirmDialogProps) {
  return (
    <AlertDialog open={confirm !== null} onOpenChange={(aberto) => !aberto && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            <SlidersHorizontal className="h-6 w-6 text-amber-600" />
          </div>
          <AlertDialogTitle>Remover o controle de estoque?</AlertDialogTitle>
          <AlertDialogDescription>
            {confirm === null ? null : (
              <>
                <strong>{confirm.item.productName}</strong> deixa de ser acompanhado: o estoque mínimo vai a
                zero e ele sai deste relatório e do alerta do painel. O produto continua no catálogo, com o
                saldo que tem, e a mudança fica no histórico dele.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Sem isto o Radix fecha o diálogo antes de a gravação terminar, e
              // o erro chegaria como toast sobre uma tela que já mudou.
              event.preventDefault();
              onConfirm();
            }}
            disabled={isSaving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isSaving ? "Salvando..." : "Remover controle"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

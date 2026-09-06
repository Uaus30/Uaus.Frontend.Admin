import { CheckCircle2, SlidersHorizontal } from "lucide-react";
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
 * As duas confirmações do relatório, num diálogo só.
 *
 * Ambas mudam o cadastro ou escondem um alerta, e nenhuma tem desfazer óbvio
 * na mesma tela — daí a pergunta. O texto cita o PRODUTO e diz o que vai
 * acontecer com ele: "tem certeza?" sozinho obriga a lembrar em qual linha se
 * clicou.
 */
export function LowStockConfirmDialog({
  confirm,
  onCancel,
  onConfirm,
  isSaving,
}: LowStockConfirmDialogProps) {
  const resolvendo = confirm?.kind === "resolve";

  return (
    <AlertDialog open={confirm !== null} onOpenChange={(aberto) => !aberto && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              resolvendo ? "bg-emerald-500/10" : "bg-amber-500/10"
            }`}
          >
            {resolvendo ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            ) : (
              <SlidersHorizontal className="h-6 w-6 text-amber-600" />
            )}
          </div>
          <AlertDialogTitle>
            {resolvendo ? "Marcar o alerta como resolvido?" : "Remover o controle de estoque?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirm === null ? null : resolvendo ? (
              <>
                <strong>{confirm.item.productName}</strong> já tem uma compra em aberto, então a reposição
                está encaminhada. O produto sai do alerta e volta a ser avaliado na próxima entrada de
                estoque.
              </>
            ) : (
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
            className={resolvendo ? "bg-emerald-600 hover:bg-emerald-700" : "bg-amber-600 hover:bg-amber-700"}
          >
            {isSaving ? "Salvando..." : resolvendo ? "Marcar como resolvido" : "Remover controle"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

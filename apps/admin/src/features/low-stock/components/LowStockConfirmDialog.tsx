import { Ban, SlidersHorizontal } from "lucide-react";
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
 * A confirmação das duas ações do menu da linha.
 *
 * As duas mudam o cadastro do produto e não têm desfazer nesta tela — daí a
 * pergunta. O texto cita o PRODUTO e diz o que vai acontecer com ele: "tem
 * certeza?" sozinho obriga a lembrar em qual linha se clicou.
 *
 * Inativar usa âmbar, e não vermelho: vermelho aqui leria como exclusão, e
 * inativar é reversível — o produto continua no catálogo, com saldo e histórico,
 * e volta pela tela dele. (A escala de cor da retaguarda está no CLAUDE.md.)
 */
export function LowStockConfirmDialog({
  confirm,
  onCancel,
  onConfirm,
  isSaving,
}: LowStockConfirmDialogProps) {
  const inativando = confirm?.action === "inactivate";

  return (
    <AlertDialog open={confirm !== null} onOpenChange={(aberto) => !aberto && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            {inativando ? (
              <Ban className="h-6 w-6 text-amber-600" />
            ) : (
              <SlidersHorizontal className="h-6 w-6 text-amber-600" />
            )}
          </div>
          <AlertDialogTitle>
            {inativando ? "Inativar o produto?" : "Remover o controle de estoque?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirm === null ? null : inativando ? (
              <>
                <strong>{confirm.item.productName}</strong> sai deste relatório, do alerta e da venda — o PDV
                e a loja deixam de oferecê-lo. Ele continua no catálogo, com o saldo e o histórico que tem, e
                pode ser reativado na tela do produto.
              </>
            ) : (
              <>
                <strong>{confirm.item.productName}</strong> deixa de ser cobrado pelo estoque mínimo, que vai
                a zero. Se ele ainda estiver acabando pelo ritmo de venda, continua no relatório — para o que
                não se quer repor, a ação é inativar. A mudança fica no histórico do produto.
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
            {isSaving ? "Salvando..." : inativando ? "Inativar produto" : "Remover controle"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

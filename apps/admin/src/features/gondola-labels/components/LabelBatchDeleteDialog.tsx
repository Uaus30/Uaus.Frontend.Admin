import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import type { ProductLabelBatchDto } from "@workspace/api-client-react";

interface LabelBatchDeleteDialogProps {
  batch: ProductLabelBatchDto | null;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Confirmação de exclusão de um lote — remove só o registro do histórico. */
export function LabelBatchDeleteDialog({
  batch,
  deleting,
  onCancel,
  onConfirm,
}: LabelBatchDeleteDialogProps) {
  return (
    <AlertDialog open={batch !== null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle>Excluir lote #{batch?.id}?</AlertDialogTitle>
          <AlertDialogDescription>
            O lote{batch?.description ? ` "${batch.description}"` : ""} sai do histórico e não
            poderá mais ser reimpresso. As etiquetas já impressas e o cadastro dos produtos não
            são afetados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={deleting}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {deleting && <Spinner className="mr-2 h-4 w-4" />}
            Sim, excluir lote
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

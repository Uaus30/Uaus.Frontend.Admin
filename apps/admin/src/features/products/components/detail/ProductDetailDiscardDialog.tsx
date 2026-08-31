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
} from "@workspace/ui";

type ProductDetailDiscardDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Confirmação de saída da tela de detalhe com alterações não salvas.
 *
 * Serve aos dois caminhos de saída — fechar pela interface e o voltar do
 * navegador interceptado — porque perder um formulário inteiro por um clique
 * errado dói mais do que responder a uma pergunta.
 */
export function ProductDetailDiscardDialog({
  open,
  onCancel,
  onConfirm,
}: ProductDetailDiscardDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(aberto) => !aberto && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
          <AlertDialogDescription>
            Há alterações não salvas neste produto. Sair agora descarta tudo o que foi preenchido
            desde o último salvamento.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar editando</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            Descartar e sair
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

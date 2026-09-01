import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui";

type ConfirmActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pergunta curta, no que vai acontecer. Ex.: "Cancelar esta venda?". */
  title: string;
  /** O que se perde ao confirmar. Obrigatória — ver o JSDoc do componente. */
  description: ReactNode;
  /** Texto do botão que executa a ação. Prefira o verbo a "OK". */
  confirmLabel?: string;
  /** Texto do botão que desiste. */
  cancelLabel?: string;
  /** Executa a ação. O diálogo se fecha sozinho depois dela. */
  onConfirm: () => void;
};

/**
 * Confirmação de ação destrutiva do PDV, ao centro da tela.
 *
 * A descrição é obrigatória de propósito: quem confirma precisa saber o que
 * perde. "Tem certeza?" não responde isso, e no balcão a pergunta aparece com o
 * cliente esperando — o operador lê uma linha, não duas.
 *
 * ## Por que não o `ConfirmDialog` do `@workspace/ui`
 *
 * Aquele é um `AlertDialog`: por definição do Radix ele NÃO fecha por Escape com
 * ação em voo nem por clique fora, e não tem o "x" de fechar. É o comportamento
 * certo para a retaguarda, onde a confirmação interrompe um formulário. No
 * balcão a regra pedida é a oposta — Escape, clique fora e "x" desistem sem
 * fazer nada —, e é o que um `Dialog` comum já entrega de graça.
 */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Sair",
  onConfirm,
}: ConfirmActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-6 bg-card border-border shadow-2xl">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-xl font-display font-bold">{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">{description}</DialogDescription>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="ghost" className="flex-1 cursor-pointer" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold cursor-pointer border-none"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

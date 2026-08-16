import { Button, Dialog, DialogContent, DialogTitle } from "@workspace/ui";

type ConfirmDiscardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Descarta o carrinho e segue para a edição da venda escolhida. */
  onConfirm: () => void;
};

/**
 * Confirmação antes de reabrir uma venda para edição com o carrinho ocupado.
 *
 * Carregar a venda por cima apagaria os itens já bipados sem aviso — e o
 * operador só descobriria na hora de fechar, com o cliente na frente.
 */
export function ConfirmDiscardDialog({ open, onOpenChange, onConfirm }: ConfirmDiscardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px] p-6 bg-card border-border shadow-2xl">
        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-destructive">
          Confirmar Descarte
        </DialogTitle>
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Há itens ativos no carrinho de compras atual. Deseja descartar esta venda em andamento para editar
            a venda selecionada?
          </p>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1 cursor-pointer" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold cursor-pointer border-none"
              onClick={onConfirm}
            >
              Descartar e Editar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

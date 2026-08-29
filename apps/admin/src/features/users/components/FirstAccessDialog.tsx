import { useState } from "react";
import { Button } from "@workspace/ui";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Check, Copy, KeyRound } from "lucide-react";
import type { FirstAccessInfo } from "../types";

interface FirstAccessDialogProps {
  /** Credenciais a mostrar, ou null com a modal fechada. */
  info: FirstAccessInfo | null;
  onClose: () => void;
}

/**
 * Credenciais do primeiro acesso, logo depois de cadastrar ou resetar a senha.
 *
 * Existe porque o administrador é quem entrega o acesso ao operador, e a senha
 * padrão não aparece em nenhum outro lugar da retaguarda. Antes a modal de
 * cadastro pedia uma senha que o servidor descartava — o administrador saía dali
 * convencido de que sabia a senha do novo usuário, e o PDV recusava o login.
 *
 * A senha vem do servidor a cada operação. Repetir aqui o valor da
 * `System:DefaultPassword` deixaria a tela mentindo no dia em que ele mudasse.
 */
export function FirstAccessDialog({ info, onClose }: FirstAccessDialogProps) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!info) return;

    await navigator.clipboard.writeText(info.password);
    setCopiado(true);
  }

  function fechar() {
    setCopiado(false);
    onClose();
  }

  return (
    <Dialog open={info !== null} onOpenChange={(open) => !open && fechar()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            {info?.origem === "reset" ? "Senha resetada" : "Usuário criado"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Passe estes dados para <span className="font-medium text-foreground">{info?.username}</span>. No
            primeiro acesso o sistema vai exigir a troca da senha — e é a troca que ativa a conta.
          </p>

          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Usuário</span>
              <span className="font-mono text-sm">{info?.username}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Senha</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm">{info?.password}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={copiar}
                  aria-label="Copiar senha"
                >
                  {copiado ? (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Esta é a senha padrão do sistema, igual para todo cadastro novo. Ela deixa de valer assim que o
            usuário definir a dele.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={fechar} className="bg-primary hover:bg-primary/90">
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

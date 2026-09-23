import { Globe } from "lucide-react";
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

type FirstPhotoSiteDialogProps = {
  open: boolean;
  /**
   * O "sim" vale na hora — a lupa da listagem grava a foto direto no servidor.
   * Sem ele (o editor), o interruptor liga no formulário e vai ao ar no Salvar.
   */
  immediate?: boolean;
  /** Travado enquanto o "sim" imediato está indo ao servidor. */
  busy?: boolean;
  /** "Exibir no site": liga o interruptor do formulário. */
  onPublish: () => void;
  /** "Agora não": fecha sem mexer em nada. */
  onDismiss: () => void;
};

/**
 * "Exibir o produto no site?" — a pergunta da primeira foto. A regra de quando
 * ela aparece está em `useFirstPhotoSitePrompt`.
 *
 * Sem cor de estado: é uma pergunta, não um alerta nem um sucesso. Verde diria
 * "já está no ar", e o produto só vai ao ar quando a pessoa salvar.
 */
export function FirstPhotoSiteDialog({
  open,
  immediate = false,
  busy = false,
  onPublish,
  onDismiss,
}: FirstPhotoSiteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(aberto) => !aberto && onDismiss()}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Globe className="h-6 w-6 text-foreground/70" />
          </div>
          <AlertDialogTitle>Exibir o produto no site?</AlertDialogTitle>
          <AlertDialogDescription>
            O cadastro ganhou a primeira foto e está com &ldquo;Exibir no site&rdquo; desligado.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <p className="rounded-lg border border-border/60 bg-muted/40 px-3.5 py-3 text-sm leading-relaxed text-muted-foreground">
          {immediate ? (
            <>
              Ligando agora, o produto vai ao ar{" "}
              <span className="font-medium text-foreground">em seguida</span>, desde que tenha variação ativa.
              Dá para mudar depois no cadastro, na aba Opcionais.
            </>
          ) : (
            <>
              Ligando agora, o produto vai ao ar quando você{" "}
              <span className="font-medium text-foreground">salvar</span>, desde que tenha variação ativa. Dá
              para mudar depois na aba Opcionais, em Visibilidade.
            </>
          )}
        </p>

        <AlertDialogFooter>
          <AlertDialogCancel type="button">Agora não</AlertDialogCancel>
          <AlertDialogAction type="button" onClick={onPublish} disabled={busy}>
            Exibir no site
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

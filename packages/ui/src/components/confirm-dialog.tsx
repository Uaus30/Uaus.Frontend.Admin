import * as React from "react";
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
} from "./alert-dialog";
import { Spinner } from "./spinner";
import { cn } from "../lib/utils";

/**
 * Contrato do ConfirmDialog.
 *
 * `description` é obrigatória de propósito. O `window.confirm` que este
 * componente substitui aceitava qualquer string, e o resultado foi um admin em
 * que "Tem certeza?" convivia com textos que explicavam o estrago — o operador
 * não tinha como saber, pela frase, se ia perder uma linha ou um histórico
 * inteiro. Exigir a descrição no tipo faz o compilador cobrar a resposta para
 * "o que exatamente eu perco se clicar em confirmar?".
 */
export interface ConfirmDialogProps {
  /** Se o diálogo está visível. Controle declarativo, como os demais diálogos. */
  open: boolean;
  /**
   * Chamado quando o diálogo pede para abrir ou fechar. Enquanto a confirmação
   * está em voo, o pedido de fechar é ignorado — ver `loading`.
   */
  onOpenChange: (open: boolean) => void;
  /** Pergunta curta, no infinitivo do que vai acontecer. Ex.: "Remover esta categoria?". */
  title: string;
  /**
   * Nome do item afetado, exibido em destaque. Serve para o operador conferir
   * que está apagando a linha que ele acha que está — em tabela paginada, o
   * clique no ícone errado é o engano mais comum.
   */
  itemName?: string;
  /** O que se perde ao confirmar. Obrigatória; ver o JSDoc do tipo. */
  description: React.ReactNode;
  /** Texto do botão de confirmação. Prefira o verbo da ação a "OK". */
  confirmLabel?: string;
  /** Texto do botão de recusa. */
  cancelLabel?: string;
  /**
   * Confirmação em andamento vinda de fora (ex.: `mutation.isPending`). O botão
   * de confirmar fica desabilitado e o diálogo não fecha por Esc: sem isso, o
   * duplo clique do operador impaciente dispara duas exclusões.
   */
  loading?: boolean;
  /** Pinta o botão de confirmação com a cor destrutiva e mostra o ícone de alerta. */
  destructive?: boolean;
  /**
   * Ação a executar. Pode devolver Promise — enquanto ela não resolve o diálogo
   * mostra o estado de carregando e continua aberto. Só fecha se resolver; se
   * rejeitar, permanece aberto para o operador tentar de novo sem refazer o
   * caminho até a linha.
   */
  onConfirm: () => void | Promise<void>;
}

/**
 * Diálogo de confirmação do kit — o substituto do `window.confirm`.
 *
 * O `confirm` nativo travava a thread do navegador, ignorava o tema da
 * aplicação, não tinha como ser coberto por teste e, no PDV instalado como app
 * (`display: standalone` no manifest), aparecia de um jeito que o operador não
 * reconhecia como parte da tela.
 *
 * O controle é declarativo (`open`/`onOpenChange`) para caber no mesmo padrão
 * dos outros diálogos do admin — a alternativa imperativa (`await confirm()`)
 * pareceria mais curta no call site, mas esconderia estado de render fora do
 * React e voltaria a ser intestável.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  itemName,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  loading = false,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [running, setRunning] = React.useState(false);
  // Espelho em ref porque dois cliques no mesmo tick do React leem o mesmo
  // estado: o `disabled` só chega ao DOM no render seguinte, e sem a ref o
  // segundo clique passaria e a exclusão sairia duplicada.
  const runningRef = React.useRef(false);
  const pending = loading || running;

  async function handleConfirm(event: React.MouseEvent<HTMLButtonElement>) {
    // Sem o preventDefault o Radix fecha o diálogo no próprio clique, e o
    // estado de carregando nunca chega a ser visto. Quem fecha somos nós,
    // depois que a ação resolve.
    event.preventDefault();
    if (runningRef.current || loading) return;

    runningRef.current = true;
    setRunning(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Fica aberto de propósito: quem chamou já mostra o erro (toast), e
      // fechar aqui obrigaria o operador a reencontrar a linha para repetir.
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Fechar no meio da ação deixaria o operador sem saber se ela saiu.
        if (pending && !next) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <AlertDialogHeader className={destructive ? "items-center text-center" : undefined}>
          {destructive && (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          )}
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {itemName && (
          <p
            className={cn(
              "break-words rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm font-medium text-foreground",
              destructive && "text-center",
            )}
          >
            {itemName}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            type="button"
            className={cn(
              destructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
            disabled={pending}
            onClick={handleConfirm}
          >
            {pending && <Spinner className="mr-2 h-4 w-4" dotClassName="h-1.5 w-1.5 bg-current" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

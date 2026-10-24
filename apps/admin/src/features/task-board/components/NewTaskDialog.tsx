import { useState } from "react";
import { Plus } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  cn,
} from "@workspace/ui";
import {
  TASK_CARD_PRIORITY,
  type TaskCardMemberDto,
  type TaskCardPriorityCode,
} from "@workspace/api-client-react";
import { RichTextEditor, isBlankRichText } from "@/components/rich-text";
import type { NewTaskInput } from "../types";
import { MemberAvatar } from "./CardBits";
import { PriorityPicker } from "./CardPickers";

interface NewTaskDialogProps {
  open: boolean;
  onClose: () => void;
  users: TaskCardMemberDto[];
  /** Quem está logado: o responsável que já vem marcado. */
  meId: number | null;
  /** Grava; o diálogo fecha quando a promessa resolve (o hook fecha). Falhou, o rascunho fica. */
  onCreate: (input: NewTaskInput) => Promise<unknown>;
  isCreating: boolean;
}

/**
 * "Nova tarefa": título, para quem, prioridade e, se quiser, a descrição. Toda
 * tarefa nasce Pendente e com um responsável (pedido do dono, 23/10/2026) — por
 * isso o responsável já vem marcado com quem está anotando, e a prioridade com
 * Normal: anotar para si mesmo é título e Enter.
 *
 * Etiquetas e anexos ficam para o detalhe, depois de criada: aqui é para anotar
 * rápido, no meio do atendimento.
 */
export function NewTaskDialog(props: NewTaskDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 p-0 sm:max-w-lg">
        {/* Montado só aberto: cada "Nova tarefa" começa do zero. */}
        {props.open && <NewTaskForm {...props} />}
      </DialogContent>
    </Dialog>
  );
}

function NewTaskForm({ onClose, users, meId, onCreate, isCreating }: NewTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<number | null>(meId);
  const [priority, setPriority] = useState<TaskCardPriorityCode>(TASK_CARD_PRIORITY.Normal);
  const [description, setDescription] = useState("");
  const [tried, setTried] = useState(false);

  const missingTitle = title.trim().length === 0;
  const missingAssignee = assigneeId === null;

  async function submit() {
    setTried(true);
    if (missingTitle || assigneeId === null || isCreating) return;
    try {
      await onCreate({
        title: title.trim(),
        description: isBlankRichText(description) ? null : description.trim(),
        priority,
        assigneeId,
      });
    } catch {
      // O hook já avisou; o rascunho fica para tentar de novo.
    }
  }

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogHeader className="border-b px-5 pb-3 pt-5">
        <DialogTitle>Nova tarefa</DialogTitle>
        <DialogDescription>Nasce pendente, para quem você escolher.</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-task-title">O que precisa ser feito?</Label>
          <Input
            id="new-task-title"
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Ex.: Ligar para a Fernanda sobre a encomenda"
            aria-invalid={tried && missingTitle}
            className={cn("h-11 text-base", tried && missingTitle && "border-destructive")}
          />
          {tried && missingTitle && (
            <p className="text-xs text-destructive">Escreva o que precisa ser feito.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Para quem</p>
          <div role="radiogroup" aria-label="Para quem" className="flex flex-wrap gap-2">
            {users.map((user) => {
              const selected = user.userId === assigneeId;
              return (
                <button
                  key={user.userId}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setAssigneeId(user.userId)}
                  className={cn(
                    "inline-flex h-9 items-center gap-2 rounded-full border pl-1 pr-3 text-sm transition-colors hover:border-foreground/30",
                    selected && "border-primary bg-primary/10 font-semibold",
                  )}
                >
                  <MemberAvatar member={user} size="sm" />
                  {user.firstName}
                  {user.userId === meId && <span className="text-muted-foreground">(eu)</span>}
                </button>
              );
            })}
          </div>
          {tried && missingAssignee && (
            <p className="text-xs text-destructive">Escolha para quem é a tarefa.</p>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">Prioridade</p>
          <PriorityPicker value={priority} onChange={setPriority} />
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium">
            Descrição <span className="font-normal text-muted-foreground">— opcional</span>
          </p>
          <RichTextEditor
            initialValue=""
            onChange={setDescription}
            onSubmit={() => void submit()}
            placeholder="Detalhes para lembrar depois: para quem, até quando, onde está…"
            ariaLabel="Descrição da nova tarefa"
            minHeight={88}
            maxHeight={220}
          />
        </div>
      </div>

      <DialogFooter className="gap-2 border-t px-5 py-4 sm:justify-between">
        <span className="hidden self-center text-[11px] text-muted-foreground sm:block">
          Ctrl+Enter na descrição salva
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isCreating} className="gap-1.5">
            <Plus className="h-4 w-4" /> {isCreating ? "Salvando…" : "Salvar tarefa"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

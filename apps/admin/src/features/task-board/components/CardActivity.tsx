import { useEffect, useRef, useState } from "react";
import { Loader2, MessagesSquare, Send } from "lucide-react";
import { Button, cn } from "@workspace/ui";
import type { TaskCardActivityDto } from "@workspace/api-client-react";
import { RichTextEditingArea, RichTextEditor, isBlankRichText } from "@/components/rich-text";
import { canEditComment, isComment } from "../activity";
import { ActivityItem } from "./ActivityItem";

interface CardActivityProps {
  activities: TaskCardActivityDto[];
  isLoading: boolean;
  isError: boolean;
  currentUserId: number | null;
  onAdd: (html: string) => Promise<unknown>;
  isAdding: boolean;
  onUpdate: (commentId: number, html: string) => Promise<unknown>;
  isUpdating: boolean;
  onDelete: (commentId: number) => Promise<unknown>;
  isDeleting: boolean;
  className?: string;
}

/**
 * A atividade do cartão, no estilo do painel do ClickUp que o dono mandou de
 * referência (05/10/2026): comentários e histórico numa lista só, do mais antigo
 * para o mais recente, com a caixa de comentário embaixo — junto do que acabou
 * de acontecer. "Só comentários" esconde o histórico quando ele fica longo.
 *
 * No desktop é um painel lateral que rola sozinho; no celular vem depois do
 * conteúdo do cartão, e quem rola é a modal.
 */
export function CardActivity(props: CardActivityProps) {
  const { activities, isLoading, isError, currentUserId, className } = props;
  const [onlyComments, setOnlyComments] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);

  const visible = onlyComments ? activities.filter(isComment) : activities;

  // O mais recente fica embaixo: ao abrir e a cada linha nova, a lista desce até
  // ele. Só faz efeito onde a lista rola sozinha (o painel lateral do desktop).
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [visible.length]);

  return (
    <section aria-label="Atividade" className={cn("flex flex-col", className)}>
      <header className="flex items-center gap-2 border-b px-4 py-3">
        <MessagesSquare className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Atividade</h3>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="ml-auto h-7 text-xs"
          aria-pressed={onlyComments}
          onClick={() => setOnlyComments((current) => !current)}
        >
          {onlyComments ? "Mostrar histórico" : "Só comentários"}
        </Button>
      </header>

      <ol ref={listRef} className="space-y-3 px-4 py-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {isLoading ? (
          <li className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando a atividade…
          </li>
        ) : isError ? (
          <li className="text-xs text-destructive">Não foi possível carregar a atividade.</li>
        ) : visible.length === 0 ? (
          <li className="text-xs text-muted-foreground">
            {onlyComments ? "Nenhum comentário ainda." : "Nada registrado ainda."}
          </li>
        ) : (
          visible.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              canEdit={canEditComment(activity, currentUserId)}
              onUpdate={props.onUpdate}
              isUpdating={props.isUpdating}
              onDelete={props.onDelete}
              isDeleting={props.isDeleting}
            />
          ))
        )}
      </ol>

      <div className="border-t p-3">
        <CommentComposer onAdd={props.onAdd} isAdding={props.isAdding} />
      </div>
    </section>
  );
}

/**
 * A caixa de comentário: fechada parece um campo; ao clicar, vira o editor com
 * a barra. Esc fecha só se não há nada escrito — não se perde texto por engano.
 */
function CommentComposer({
  onAdd,
  isAdding,
}: {
  onAdd: (html: string) => Promise<unknown>;
  isAdding: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const blank = isBlankRichText(draft);

  function close() {
    setDraft("");
    setOpen(false);
  }

  async function submit() {
    if (blank || isAdding) return;
    try {
      await onAdd(draft);
      close();
    } catch {
      // O hook já avisou; o rascunho fica para tentar de novo.
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-md border bg-foreground/[0.04] px-3 py-2 text-left text-sm text-muted-foreground hover:bg-foreground/10"
      >
        Escreva um comentário…
      </button>
    );
  }

  return (
    <RichTextEditingArea
      onCancel={() => {
        if (blank) close();
      }}
      className="space-y-2"
    >
      <RichTextEditor
        autoFocus
        onChange={setDraft}
        onSubmit={() => void submit()}
        placeholder="Escreva um comentário…"
        ariaLabel="Novo comentário"
        minHeight={72}
        // No painel lateral a caixa divide a altura com a lista: sem teto, um
        // texto longo empurraria o "Comentar" para fora da modal.
        maxHeight={240}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="gap-1.5"
          onClick={() => void submit()}
          disabled={blank || isAdding}
        >
          <Send className="h-3.5 w-3.5" /> {isAdding ? "Enviando…" : "Comentar"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={close}>
          Cancelar
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground">Ctrl+Enter envia</span>
      </div>
    </RichTextEditingArea>
  );
}

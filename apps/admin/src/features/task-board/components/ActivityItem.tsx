import { useState } from "react";
import { Button, ConfirmDialog, cn } from "@workspace/ui";
import type { TaskCardActivityDto } from "@workspace/api-client-react";
import { RichTextEditingArea, RichTextEditor, RichTextView, isBlankRichText } from "@/components/rich-text";
import { describeActivity, formatActivityDate, initials, isComment } from "../activity";
import { memberColor } from "../board";
import { ColumnBadge } from "./CardBits";

interface ActivityItemProps {
  activity: TaskCardActivityDto;
  /** É comentário de quem está na sessão: mostra "Editar" e "Excluir". */
  canEdit: boolean;
  onUpdate: (commentId: number, html: string) => Promise<unknown>;
  isUpdating: boolean;
  onDelete: (commentId: number) => Promise<unknown>;
  isDeleting: boolean;
}

/** Uma linha da linha do tempo: o comentário em caixa, o fato do histórico em uma linha discreta. */
export function ActivityItem(props: ActivityItemProps) {
  return isComment(props.activity) ? <CommentItem {...props} /> : <HistoryItem activity={props.activity} />;
}

/** "Ana Souza moveu o cartão de [Fazendo] para [Testes] · 05/10/2026 às 14:32" */
function HistoryItem({ activity }: { activity: TaskCardActivityDto }) {
  const phrase = describeActivity(activity);

  return (
    <li className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
      <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
      <p className="min-w-0">
        <span className="font-medium text-foreground/90">{activity.author ?? "Sistema"}</span> {phrase.text}
        {phrase.quote && <span className="text-foreground/90"> “{phrase.quote}”</span>}
        {phrase.from != null && phrase.to != null ? (
          <>
            {" de "}
            <ColumnBadge status={phrase.from} className="px-1.5 py-0 text-[11px]" />
            {" para "}
            <ColumnBadge status={phrase.to} className="px-1.5 py-0 text-[11px]" />
          </>
        ) : (
          phrase.to != null && (
            <>
              {" em "}
              <ColumnBadge status={phrase.to} className="px-1.5 py-0 text-[11px]" />
            </>
          )
        )}
        <time dateTime={activity.createdAt} className="whitespace-nowrap">
          {" · "}
          {formatActivityDate(activity.createdAt)}
        </time>
      </p>
    </li>
  );
}

function CommentItem({ activity, canEdit, onUpdate, isUpdating, onDelete, isDeleting }: ActivityItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(activity.text ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const author = activity.author ?? "Sistema";

  async function save() {
    if (isBlankRichText(draft) || isUpdating) return;
    // Sem mudança não é edição: gravar marcaria "(editado)" à toa (o servidor
    // também ignora, mas nem precisa da ida e volta).
    if (draft.trim() === (activity.text ?? "").trim()) {
      setEditing(false);
      return;
    }
    try {
      await onUpdate(activity.id, draft);
      setEditing(false);
    } catch {
      // O hook já avisou; o rascunho fica para tentar de novo.
    }
  }

  return (
    <li className="flex gap-2">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 inline-flex h-7 w-7 shrink-0 select-none items-center justify-center rounded-full text-[11px] font-bold text-white",
          memberColor(activity.userId ?? 0),
        )}
      >
        {initials(author)}
      </span>

      <div className="min-w-0 flex-1 rounded-lg border bg-background/60 px-3 py-2">
        <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
          <span className="text-sm font-semibold">{author}</span>
          <time dateTime={activity.createdAt} className="text-muted-foreground">
            {formatActivityDate(activity.createdAt)}
          </time>
          {activity.updatedAt && (
            <span
              className="text-muted-foreground"
              title={`Editado em ${formatActivityDate(activity.updatedAt)}`}
            >
              (editado)
            </span>
          )}
          {canEdit && !editing && (
            <span className="ml-auto flex gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs"
                onClick={() => {
                  setDraft(activity.text ?? "");
                  setEditing(true);
                }}
              >
                Editar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => setConfirmDelete(true)}
              >
                Excluir
              </Button>
            </span>
          )}
        </div>

        {editing ? (
          <RichTextEditingArea onCancel={() => setEditing(false)} className="mt-2 space-y-2">
            <RichTextEditor
              initialValue={activity.text}
              autoFocus
              onChange={setDraft}
              onSubmit={() => void save()}
              ariaLabel="Editar comentário"
              minHeight={64}
              maxHeight={240}
            />
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => void save()}
                disabled={isUpdating || isBlankRichText(draft)}
              >
                {isUpdating ? "Salvando…" : "Salvar"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </RichTextEditingArea>
        ) : (
          <RichTextView value={activity.text} className="mt-1" />
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir este comentário?"
        description="O comentário some da atividade do cartão e não volta pela tela."
        confirmLabel="Sim, excluir"
        destructive
        loading={isDeleting}
        onConfirm={async () => {
          try {
            await onDelete(activity.id);
          } catch {
            // O hook já avisou.
          }
          setConfirmDelete(false);
        }}
      />
    </li>
  );
}

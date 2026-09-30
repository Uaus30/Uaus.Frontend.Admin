import { useState } from "react";
import { Archive, ArchiveRestore, Clock, Loader2, Trash2 } from "lucide-react";
import {
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui";
import { formatBrasiliaDateTime } from "@workspace/core";
import type { TaskCardStatusCode } from "@workspace/api-client-react";
import { BOARD_COLUMNS, statusCode } from "../board";
import { useTaskCard } from "../hooks/useTaskCard";
import { CardAttachments } from "./CardAttachments";
import { ColumnBadge, MemberAvatar, TaskLabelChip } from "./CardBits";
import { CardChecklist } from "./CardChecklist";
import { CardDescription } from "./CardDescription";
import { LabelsPicker, MembersPicker } from "./CardPickers";

interface TaskCardDialogProps {
  cardId: number | null;
  onClose: () => void;
  onMove: (cardId: number, status: TaskCardStatusCode) => Promise<unknown>;
  onArchive: (cardId: number) => Promise<unknown>;
  onUnarchive: (cardId: number) => Promise<unknown>;
  onDelete: (cardId: number) => Promise<unknown>;
  onManageLabels: () => void;
  isArchiving: boolean;
  isDeleting: boolean;
}

/**
 * A modal de detalhe do cartão. No celular ocupa a tela inteira; no desktop é
 * uma caixa larga com o conteúdo à esquerda e as ações à direita, como no
 * Trello. O corpo rola nativamente (`overflow-y-auto`), não com `ScrollArea` —
 * armadilha 7 do CLAUDE.md.
 */
export function TaskCardDialog(props: TaskCardDialogProps) {
  const {
    cardId,
    onClose,
    onMove,
    onArchive,
    onUnarchive,
    onDelete,
    onManageLabels,
    isArchiving,
    isDeleting,
  } = props;
  const ctl = useTaskCard(cardId);
  const card = ctl.card;

  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <Dialog open={cardId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[100dvh] w-full max-w-none flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-xl">
        {!card ? (
          <div className="flex flex-1 items-center justify-center p-10 text-muted-foreground">
            {ctl.isError ? (
              "Não foi possível abrir o cartão."
            ) : (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Abrindo…
              </span>
            )}
            <DialogTitle className="sr-only">Cartão</DialogTitle>
            <DialogDescription className="sr-only">Detalhe do cartão</DialogDescription>
          </div>
        ) : (
          <>
            <header className="space-y-2 border-b px-4 pb-3 pr-12 pt-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">#{card.number}</span>
                <ColumnBadge status={card.status} />
                {card.isArchived && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                    <Archive className="h-3 w-3" /> Arquivado
                  </span>
                )}
              </div>
              <DialogTitle asChild>
                {/* `key` remonta o campo quando o servidor devolve outro título — sem efeito. */}
                <CardTitleInput key={card.title} title={card.title} onSave={ctl.saveTitle} />
              </DialogTitle>
              <DialogDescription className="sr-only">
                Detalhe e edição do cartão #{card.number}
              </DialogDescription>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid gap-6 p-4 sm:grid-cols-[1fr_190px] sm:p-6">
                <div className="min-w-0 space-y-6">
                  {(card.labels.length > 0 || card.members.length > 0) && (
                    <div className="flex flex-wrap items-start gap-4">
                      {card.labels.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Etiquetas</p>
                          <div className="flex flex-wrap gap-1">
                            {card.labels.map((label) => (
                              <TaskLabelChip key={label.id} label={label} />
                            ))}
                          </div>
                        </div>
                      )}
                      {card.members.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Membros</p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {card.members.map((member) => (
                              <span key={member.userId} className="inline-flex items-center gap-1.5 text-sm">
                                <MemberAvatar member={member} size="sm" />
                                {member.firstName}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <CardDescription
                    key={card.description ?? ""}
                    value={card.description ?? ""}
                    onSave={ctl.saveDescription}
                    isSaving={ctl.isSaving}
                  />

                  <CardChecklist
                    items={card.checklistItems}
                    onAdd={ctl.addChecklistItem}
                    onToggle={ctl.toggleChecklistItem}
                    onRename={ctl.renameChecklistItem}
                    onDelete={ctl.deleteChecklistItem}
                    busy={ctl.isChecklistBusy}
                  />

                  <CardAttachments
                    attachments={card.attachments}
                    onUpload={ctl.uploadAttachment}
                    isUploading={ctl.isUploading}
                    onDelete={ctl.deleteAttachment}
                    isDeleting={ctl.isDeletingAttachment}
                  />
                </div>

                <aside className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Coluna</p>
                  <Select
                    value={String(statusCode(card.status))}
                    onValueChange={(value) => void onMove(card.id, Number(value) as TaskCardStatusCode)}
                    disabled={card.isArchived}
                  >
                    <SelectTrigger className="h-9 w-full text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOARD_COLUMNS.map((column) => (
                        <SelectItem key={column.status} value={String(column.status)}>
                          <span className="inline-flex items-center gap-2">
                            <span className={`h-2 w-2 rounded-full ${column.dot}`} />
                            {column.title}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <p className="pt-2 text-xs font-medium text-muted-foreground">Adicionar ao cartão</p>
                  <LabelsPicker
                    labels={ctl.labels}
                    selectedIds={card.labels.map((l) => l.id)}
                    onToggle={ctl.toggleLabel}
                    onManage={onManageLabels}
                    disabled={ctl.isSaving}
                  />
                  <MembersPicker
                    users={ctl.users}
                    selectedIds={card.members.map((m) => m.userId)}
                    onToggle={ctl.toggleMember}
                    disabled={ctl.isSaving}
                  />

                  <p className="pt-2 text-xs font-medium text-muted-foreground">Ações</p>
                  {card.isArchived ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start gap-2"
                      disabled={isArchiving}
                      onClick={() => void onUnarchive(card.id)}
                    >
                      <ArchiveRestore className="h-4 w-4" /> Desarquivar
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="w-full justify-start gap-2"
                      disabled={isArchiving}
                      onClick={() => void onArchive(card.id)}
                    >
                      <Archive className="h-4 w-4" /> Arquivar
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10"
                    disabled={isDeleting}
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="h-4 w-4" /> Excluir
                  </Button>

                  <div className="space-y-1 pt-3 text-[11px] leading-relaxed text-muted-foreground">
                    <p className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Criado em {formatBrasiliaDateTime(card.createdAt)}
                      {card.createdBy ? ` por ${card.createdBy}` : ""}
                    </p>
                    {card.updatedAt && <p>Atualizado em {formatBrasiliaDateTime(card.updatedAt)}</p>}
                    {card.finishedAt && <p>Finalizado em {formatBrasiliaDateTime(card.finishedAt)}</p>}
                  </div>
                </aside>
              </div>
            </div>

            <ConfirmDialog
              open={confirmDelete}
              onOpenChange={setConfirmDelete}
              title="Excluir este cartão?"
              itemName={`#${card.number} — ${card.title}`}
              description="O cartão some do quadro, da busca e dos arquivados, com o checklist e os anexos. O número dele não é reaproveitado. Para tirar do quadro sem perder, prefira Arquivar."
              confirmLabel="Sim, excluir"
              destructive
              loading={isDeleting}
              onConfirm={async () => {
                await onDelete(card.id);
                setConfirmDelete(false);
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface CardTitleInputProps {
  title: string;
  onSave: (title: string) => void;
}

/** O título editável no lugar: salva ao sair do campo ou no Enter; Esc desfaz. */
function CardTitleInput({ title, onSave }: CardTitleInputProps) {
  const [value, setValue] = useState(title);

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSave(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setValue(title);
      }}
      maxLength={200}
      aria-label="Título do cartão"
      className="w-full rounded-md bg-transparent px-1 text-lg font-semibold leading-tight tracking-tight outline-none ring-ring focus:bg-foreground/10 focus:ring-2"
    />
  );
}

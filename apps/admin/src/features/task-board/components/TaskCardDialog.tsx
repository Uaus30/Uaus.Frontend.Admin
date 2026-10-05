import { useRef, useState } from "react";
import { Archive, CircleCheckBig, Loader2, TextAlignStart } from "lucide-react";
import { Button, ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui";
import { TASK_CARD_STATUS, type TaskCardStatusCode } from "@workspace/api-client-react";
import { RICH_TEXT_EDITING_ATTRIBUTE } from "@/components/rich-text";
import { statusCode } from "../board";
import { useCardActivity } from "../hooks/useCardActivity";
import { useTaskCard } from "../hooks/useTaskCard";
import { CardActivity } from "./CardActivity";
import { CardAttachments } from "./CardAttachments";
import { ColumnBadge, MemberAvatar, TaskLabelChip } from "./CardBits";
import { CardChecklist } from "./CardChecklist";
import { CardRichTextField } from "./CardRichTextField";
import { CardSidebar } from "./CardSidebar";
import { CardTitleInput } from "./CardTitleInput";

interface TaskCardDialogProps {
  cardId: number | null;
  onClose: () => void;
  onMove: (cardId: number, status: TaskCardStatusCode) => Promise<unknown>;
  /** "Finalizar tarefa": para o fim de Finalizado, de qualquer coluna. */
  onFinish: (cardId: number) => Promise<unknown>;
  isMoving: boolean;
  onArchive: (cardId: number) => Promise<unknown>;
  onUnarchive: (cardId: number) => Promise<unknown>;
  onDelete: (cardId: number) => Promise<unknown>;
  onManageLabels: () => void;
  isArchiving: boolean;
  isDeleting: boolean;
}

/**
 * A modal de detalhe do cartão. No celular ocupa a tela inteira e tudo rola
 * junto, com a atividade no fim; no desktop largo são dois painéis, como no
 * ClickUp: o cartão (conteúdo e ações) à esquerda e a atividade à direita, cada
 * um com a própria rolagem. A rolagem é nativa (`overflow-y-auto`), não
 * `ScrollArea` — armadilha 7 do CLAUDE.md.
 *
 * Esc dentro de um editor de texto cancela a edição e NÃO fecha a modal: o Radix
 * trata o Esc antes do editor, e fechar a modal no meio de um comentário perderia
 * o que foi escrito.
 */
export function TaskCardDialog(props: TaskCardDialogProps) {
  const { cardId, onClose, onFinish, isMoving, onDelete, isDeleting } = props;
  const ctl = useTaskCard(cardId);
  const activity = useCardActivity(cardId);
  const card = ctl.card;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isDone = card !== null && statusCode(card.status) === TASK_CARD_STATUS.Done;
  const canFinish = card !== null && !isDone && !card.isArchived;

  return (
    <Dialog open={cardId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={contentRef}
        onEscapeKeyDown={(e) => {
          // Com uma edição aberta (descrição, solução, comentário), o Esc é dela: a
          // área de edição cancela se o foco está nela, e a modal não fecha levando o
          // rascunho junto. Sem edição aberta, o Esc fecha a modal como sempre.
          if (contentRef.current?.querySelector(`[${RICH_TEXT_EDITING_ATTRIBUTE}]`)) e.preventDefault();
        }}
        className="flex h-[100dvh] w-full max-w-none flex-col gap-0 rounded-none p-0 sm:h-[92vh] sm:max-w-4xl sm:rounded-xl lg:max-w-6xl"
      >
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
            <header className="space-y-2 border-b px-4 pb-3 pr-12 pt-4 sm:px-6 sm:pr-14">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">#{card.number}</span>
                <ColumnBadge status={card.status} />
                {card.isArchived && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5">
                    <Archive className="h-3 w-3" /> Arquivado
                  </span>
                )}
                {isDone ? (
                  <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CircleCheckBig className="h-3.5 w-3.5" /> Finalizada
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="ml-auto h-8 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={!canFinish || isMoving}
                    title={card.isArchived ? "Desarquive o cartão para finalizá-lo" : undefined}
                    onClick={() => void onFinish(card.id)}
                  >
                    <CircleCheckBig className="h-4 w-4" /> Finalizar tarefa
                  </Button>
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

            <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
              <div className="lg:min-h-0 lg:overflow-y-auto">
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
                                <span
                                  key={member.userId}
                                  className="inline-flex items-center gap-1.5 text-sm"
                                >
                                  <MemberAvatar member={member} size="sm" />
                                  {member.firstName}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <CardRichTextField
                      key={`description-${card.description ?? ""}`}
                      title="Descrição"
                      icon={TextAlignStart}
                      value={card.description ?? ""}
                      emptyLabel="Adicionar uma descrição mais detalhada…"
                      placeholder="Detalhe a demanda: o que precisa ser feito, para quem, até quando…"
                      ariaLabel="Descrição do cartão"
                      onSave={ctl.saveDescription}
                      isSaving={ctl.isSaving}
                    />

                    <CardRichTextField
                      key={`solution-${card.solution ?? ""}`}
                      title="Solução"
                      icon={CircleCheckBig}
                      value={card.solution ?? ""}
                      emptyLabel="Registrar como a demanda foi resolvida…"
                      placeholder="O que foi feito, onde, e o que conferir se voltar a acontecer…"
                      ariaLabel="Solução do cartão"
                      onSave={(html) => ctl.saveSolution(html)}
                      onSaveAndFinish={canFinish ? (html) => ctl.saveSolution(html, true) : undefined}
                      isSaving={ctl.isSavingSolution}
                      highlightFilled
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

                  <CardSidebar
                    card={card}
                    labels={ctl.labels}
                    users={ctl.users}
                    onToggleLabel={ctl.toggleLabel}
                    onToggleMember={ctl.toggleMember}
                    isSaving={ctl.isSaving}
                    onMove={props.onMove}
                    onManageLabels={props.onManageLabels}
                    onArchive={props.onArchive}
                    onUnarchive={props.onUnarchive}
                    isArchiving={props.isArchiving}
                    onRequestDelete={() => setConfirmDelete(true)}
                    isDeleting={isDeleting}
                  />
                </div>
              </div>

              <CardActivity
                className="border-t lg:min-h-0 lg:border-l lg:border-t-0"
                activities={activity.activities}
                isLoading={activity.isLoading}
                isError={activity.isError}
                currentUserId={activity.currentUserId}
                onAdd={activity.addComment}
                isAdding={activity.isAdding}
                onUpdate={activity.updateComment}
                isUpdating={activity.isUpdating}
                onDelete={activity.deleteComment}
                isDeleting={activity.isDeleting}
              />
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

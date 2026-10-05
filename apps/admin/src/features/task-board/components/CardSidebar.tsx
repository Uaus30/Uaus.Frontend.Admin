import { Archive, ArchiveRestore, Clock, Trash2 } from "lucide-react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { formatBrasiliaDateTime } from "@workspace/core";
import type {
  TaskCardDto,
  TaskCardMemberDto,
  TaskCardStatusCode,
  TaskLabelDto,
} from "@workspace/api-client-react";
import { BOARD_COLUMNS, statusCode } from "../board";
import { LabelsPicker, MembersPicker } from "./CardPickers";

interface CardSidebarProps {
  card: TaskCardDto;
  labels: TaskLabelDto[];
  users: TaskCardMemberDto[];
  onToggleLabel: (labelId: number) => void;
  onToggleMember: (userId: number) => void;
  isSaving: boolean;
  onMove: (cardId: number, status: TaskCardStatusCode) => Promise<unknown>;
  onManageLabels: () => void;
  onArchive: (cardId: number) => Promise<unknown>;
  onUnarchive: (cardId: number) => Promise<unknown>;
  isArchiving: boolean;
  onRequestDelete: () => void;
  isDeleting: boolean;
}

/**
 * A coluna de ações da modal, à direita do conteúdo como no Trello: coluna,
 * etiquetas, membros, arquivar, excluir e as datas do cartão.
 */
export function CardSidebar(props: CardSidebarProps) {
  const { card } = props;

  return (
    <aside className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Coluna</p>
      <Select
        value={String(statusCode(card.status))}
        onValueChange={(value) => void props.onMove(card.id, Number(value) as TaskCardStatusCode)}
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
        labels={props.labels}
        selectedIds={card.labels.map((l) => l.id)}
        onToggle={props.onToggleLabel}
        onManage={props.onManageLabels}
        disabled={props.isSaving}
      />
      <MembersPicker
        users={props.users}
        selectedIds={card.members.map((m) => m.userId)}
        onToggle={props.onToggleMember}
        disabled={props.isSaving}
      />

      <p className="pt-2 text-xs font-medium text-muted-foreground">Ações</p>
      {card.isArchived ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={props.isArchiving}
          onClick={() => void props.onUnarchive(card.id)}
        >
          <ArchiveRestore className="h-4 w-4" /> Desarquivar
        </Button>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="w-full justify-start gap-2"
          disabled={props.isArchiving}
          onClick={() => void props.onArchive(card.id)}
        >
          <Archive className="h-4 w-4" /> Arquivar
        </Button>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10"
        disabled={props.isDeleting}
        onClick={props.onRequestDelete}
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
  );
}

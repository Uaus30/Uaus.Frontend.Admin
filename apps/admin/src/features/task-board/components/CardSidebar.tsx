import { Clock, Trash2 } from "lucide-react";
import { Button } from "@workspace/ui";
import { formatBrasiliaDateTime } from "@workspace/core";
import type {
  TaskCardDto,
  TaskCardMemberDto,
  TaskCardPriorityCode,
  TaskLabelDto,
} from "@workspace/api-client-react";
import { priorityCode } from "../tasks";
import { AssigneePicker, LabelsPicker, PriorityPicker } from "./CardPickers";

interface CardSidebarProps {
  card: TaskCardDto;
  labels: TaskLabelDto[];
  users: TaskCardMemberDto[];
  onAssign: (userId: number) => void;
  onPriority: (priority: TaskCardPriorityCode) => void;
  onToggleLabel: (labelId: number) => void;
  isSaving: boolean;
  onManageLabels: () => void;
  onRequestDelete: () => void;
  isDeleting: boolean;
}

/**
 * A coluna de ações do detalhe, à direita do conteúdo: responsável, prioridade,
 * etiquetas, excluir e as datas da tarefa. Concluir e reabrir ficam no topo da
 * modal, em destaque — é a ação que se faz toda vez.
 */
export function CardSidebar(props: CardSidebarProps) {
  const { card } = props;

  return (
    <aside className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Responsável</p>
      <AssigneePicker
        users={props.users}
        assignee={card.assignee}
        onChange={props.onAssign}
        disabled={props.isSaving}
      />

      <p className="pt-2 text-xs font-medium text-muted-foreground">Prioridade</p>
      <PriorityPicker
        value={priorityCode(card.priority)}
        onChange={props.onPriority}
        disabled={props.isSaving}
        columns={2}
      />

      <p className="pt-2 text-xs font-medium text-muted-foreground">Classificar</p>
      <LabelsPicker
        labels={props.labels}
        selectedIds={card.labels.map((l) => l.id)}
        onToggle={props.onToggleLabel}
        onManage={props.onManageLabels}
        disabled={props.isSaving}
      />

      <p className="pt-2 text-xs font-medium text-muted-foreground">Ações</p>
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
          <Clock className="h-3 w-3" /> Anotada em {formatBrasiliaDateTime(card.createdAt)}
          {card.createdBy ? ` por ${card.createdBy}` : ""}
        </p>
        {card.updatedAt && <p>Atualizada em {formatBrasiliaDateTime(card.updatedAt)}</p>}
        {card.finishedAt && <p>Concluída em {formatBrasiliaDateTime(card.finishedAt)}</p>}
      </div>
    </aside>
  );
}

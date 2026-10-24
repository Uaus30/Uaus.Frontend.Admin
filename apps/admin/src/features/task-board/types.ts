import type {
  TaskCardDto,
  TaskCardPriorityCode,
  TaskCardStatusCode,
  TaskCardSummaryDto,
  TaskLabelColor,
  TaskLabelDto,
  TaskLabelPriorityCode,
} from "@workspace/api-client-react";

/**
 * Formulário de etiqueta, como digitado. A prioridade não aparece mais na tela
 * (desde 23/10/2026 é da tarefa), mas o servidor a exige: a edição devolve a que a
 * etiqueta já tinha, e a criação manda "sem prioridade".
 */
export interface TaskLabelForm {
  name: string;
  color: TaskLabelColor;
  priority: TaskLabelPriorityCode;
}

/** Uma tarefa nova, como o diálogo "Nova tarefa" a monta. */
export interface NewTaskInput {
  title: string;
  /** HTML do editor; nulo sem descrição. */
  description: string | null;
  priority: TaskCardPriorityCode;
  assigneeId: number;
}

export type { TaskCardDto, TaskCardStatusCode, TaskCardSummaryDto, TaskLabelDto };

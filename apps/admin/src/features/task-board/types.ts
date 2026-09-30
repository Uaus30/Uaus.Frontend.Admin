import type {
  TaskCardDto,
  TaskCardStatusCode,
  TaskCardSummaryDto,
  TaskLabelColor,
  TaskLabelDto,
  TaskLabelPriorityCode,
} from "@workspace/api-client-react";

/** Formulário de etiqueta, como digitado. */
export interface TaskLabelForm {
  name: string;
  color: TaskLabelColor;
  priority: TaskLabelPriorityCode;
}

/** O que o quadro precisa saber para mover um cartão. */
export interface MoveCardInput {
  cardId: number;
  status: TaskCardStatusCode;
  /** Zero = "no fim da coluna" (o servidor calcula). */
  position: number;
}

export type { TaskCardDto, TaskCardStatusCode, TaskCardSummaryDto, TaskLabelDto };

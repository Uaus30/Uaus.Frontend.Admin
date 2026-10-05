import {
  enumCode,
  TASK_CARD_ACTIVITY_KIND,
  TASK_CARD_STATUS,
  type EnumValue,
  type TaskCardActivityDto,
} from "@workspace/api-client-react";
import { formatBrasiliaDateTime } from "@workspace/core";

/**
 * Regras puras da linha do tempo do cartão (comentários e histórico): a frase de
 * cada fato e quem pode mexer em qual comentário. O servidor manda o fato
 * (tipo, complemento, colunas); a frase é daqui.
 */

const KIND = TASK_CARD_ACTIVITY_KIND;

/** Código numérico do tipo, venha ele pelo nome ("Moved") ou pelo número. */
export function activityKind(activity: TaskCardActivityDto): number {
  return enumCode(activity.kind, KIND);
}

export function isComment(activity: TaskCardActivityDto): boolean {
  return activityKind(activity) === KIND.Comment;
}

/**
 * Uma linha do histórico, pronta para desenhar: o verbo, o complemento entre
 * aspas (nome da etiqueta, do anexo…) e as colunas quando houve movimento.
 */
export interface ActivityPhrase {
  /** "moveu o cartão", "registrou a solução"… — sem o nome de quem fez, que vem antes. */
  text: string;
  /** O complemento, exibido entre aspas depois do verbo. */
  quote?: string;
  /** Coluna de origem, para o badge "de". */
  from?: EnumValue;
  /** Coluna de destino (ou a de nascimento), para o badge "para"/"em". */
  to?: EnumValue;
}

const SIMPLE: Record<number, string> = {
  [KIND.Archived]: "arquivou o cartão",
  [KIND.Unarchived]: "desarquivou o cartão",
  [KIND.DescriptionChanged]: "editou a descrição",
  [KIND.SolutionAdded]: "registrou a solução",
  [KIND.SolutionEdited]: "editou a solução",
  [KIND.SolutionRemoved]: "removeu a solução",
};

const WITH_QUOTE: Record<number, string> = {
  [KIND.TitleChanged]: "renomeou o cartão para",
  [KIND.LabelAdded]: "adicionou a etiqueta",
  [KIND.LabelRemoved]: "removeu a etiqueta",
  [KIND.MemberAdded]: "adicionou o membro",
  [KIND.MemberRemoved]: "removeu o membro",
  [KIND.AttachmentAdded]: "anexou",
  [KIND.AttachmentRemoved]: "removeu o anexo",
  [KIND.ChecklistItemAdded]: "adicionou ao checklist",
  [KIND.ChecklistItemChecked]: "concluiu no checklist",
  [KIND.ChecklistItemUnchecked]: "reabriu no checklist",
  [KIND.ChecklistItemRemoved]: "removeu do checklist",
};

/**
 * A frase de um fato do histórico. Ir para Finalizado é dito como "finalizou a
 * tarefa" — é o que o botão "Finalizar tarefa" e o "Salvar e finalizar" fazem, e
 * o que a pessoa procura ao ler a linha do tempo. Tipo desconhecido (um servidor
 * mais novo que a tela) vira "atualizou o cartão", nunca linha em branco.
 */
export function describeActivity(activity: TaskCardActivityDto): ActivityPhrase {
  const kind = activityKind(activity);
  const quote = activity.text ?? undefined;

  if (kind === KIND.Created) return { text: "criou o cartão", to: activity.toStatus ?? undefined };

  if (kind === KIND.Moved) {
    const finished = enumCode(activity.toStatus, TASK_CARD_STATUS) === TASK_CARD_STATUS.Done;
    return {
      text: finished ? "finalizou a tarefa" : "moveu o cartão",
      from: activity.fromStatus ?? undefined,
      to: activity.toStatus ?? undefined,
    };
  }

  if (kind in SIMPLE) return { text: SIMPLE[kind] };
  if (kind in WITH_QUOTE) return { text: WITH_QUOTE[kind], quote };

  return { text: "atualizou o cartão" };
}

/**
 * Só o autor edita e exclui o próprio comentário — a mesma regra do servidor,
 * que recusa os outros. Sem sessão carregada, ninguém.
 */
export function canEditComment(
  activity: TaskCardActivityDto,
  currentUserId: number | null | undefined,
): boolean {
  return isComment(activity) && currentUserId != null && activity.userId === currentUserId;
}

/** "05/10/2026 às 14:32" — a hora sem os segundos, que na linha do tempo só fazem ruído. */
export function formatActivityDate(value: string): string {
  return formatBrasiliaDateTime(value).replace(/:\d{2}$/, "");
}

/** Iniciais para o avatar: "Ana Souza" → "AS"; nome único → a primeira letra. */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0].charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
  return (first + last).toUpperCase();
}

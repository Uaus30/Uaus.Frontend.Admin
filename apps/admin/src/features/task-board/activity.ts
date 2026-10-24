import {
  enumCode,
  TASK_CARD_ACTIVITY_KIND,
  TASK_CARD_STATUS,
  type EnumValue,
  type TaskCardActivityDto,
} from "@workspace/api-client-react";
import { formatBrasiliaDateTime } from "@workspace/core";

/**
 * Regras puras da linha do tempo da tarefa (comentários e histórico): a frase de
 * cada fato e quem pode mexer em qual comentário. O servidor manda o fato
 * (tipo, complemento, situações); a frase é daqui. Arquivar, membros, checklist e
 * as colunas Backlog/Fazendo/Testes saíram em 23/10/2026 e só aparecem nas linhas
 * antigas — por isso as frases deles continuam aqui.
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
 * aspas (nome da etiqueta, do anexo…) e as situações quando houve movimento
 * entre colunas do quadro antigo.
 */
export interface ActivityPhrase {
  /** "concluiu a tarefa", "registrou a solução"… — sem o nome de quem fez, que vem antes. */
  text: string;
  /** O complemento, exibido entre aspas depois do verbo. */
  quote?: string;
  /** Situação de origem, para o selo "de". */
  from?: EnumValue;
  /** Situação de destino (ou a de nascimento), para o selo "para"/"em". */
  to?: EnumValue;
}

const SIMPLE: Record<number, string> = {
  [KIND.Archived]: "arquivou a tarefa",
  [KIND.Unarchived]: "desarquivou a tarefa",
  [KIND.DescriptionChanged]: "editou a descrição",
  [KIND.SolutionAdded]: "registrou a solução",
  [KIND.SolutionEdited]: "editou a solução",
  [KIND.SolutionRemoved]: "removeu a solução",
};

const WITH_QUOTE: Record<number, string> = {
  [KIND.TitleChanged]: "renomeou a tarefa para",
  [KIND.PriorityChanged]: "mudou a prioridade para",
  [KIND.AssigneeChanged]: "passou a tarefa para",
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
 * A frase de um fato do histórico. Ir para Finalizado é "concluiu a tarefa" e
 * voltar dele é "reabriu a tarefa" — é o que os botões fazem, e as situações não
 * vão junto porque seriam óbvias. As situações só aparecem nos movimentos do
 * quadro antigo ("moveu a tarefa de Fazendo para Testes") e no nascimento fora de
 * Pendente. Tipo desconhecido (um servidor mais novo que a tela) vira "atualizou
 * a tarefa", nunca linha em branco.
 */
export function describeActivity(activity: TaskCardActivityDto): ActivityPhrase {
  const kind = activityKind(activity);
  const quote = activity.text ?? undefined;
  const from = enumCode(activity.fromStatus, TASK_CARD_STATUS);
  const to = enumCode(activity.toStatus, TASK_CARD_STATUS);

  if (kind === KIND.Created) {
    return {
      text: "criou a tarefa",
      to: activity.toStatus != null && to !== TASK_CARD_STATUS.Pending ? activity.toStatus : undefined,
    };
  }

  if (kind === KIND.Moved) {
    if (to === TASK_CARD_STATUS.Done) return { text: "concluiu a tarefa" };
    if (from === TASK_CARD_STATUS.Done && to === TASK_CARD_STATUS.Pending)
      return { text: "reabriu a tarefa" };
    return {
      text: "moveu a tarefa",
      from: activity.fromStatus ?? undefined,
      to: activity.toStatus ?? undefined,
    };
  }

  if (kind in SIMPLE) return { text: SIMPLE[kind] };
  if (kind in WITH_QUOTE) return { text: WITH_QUOTE[kind], quote };

  return { text: "atualizou a tarefa" };
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

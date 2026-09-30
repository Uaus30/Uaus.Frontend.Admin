import {
  enumCode,
  TASK_CARD_STATUS,
  TASK_LABEL_PRIORITY,
  type EnumValue,
  type TaskCardStatusCode,
  type TaskCardSummaryDto,
  type TaskLabelDto,
} from "@workspace/api-client-react";

/**
 * Regras puras do quadro: colunas, cores, posição e agrupamento. Sem React e sem
 * rede, para os testes rodarem sem montar nada.
 */

/** Uma coluna do quadro. `dot` e `ring` são classes do tema; a cor é decisão do dono (30/09/2026). */
export interface BoardColumnDef {
  status: TaskCardStatusCode;
  title: string;
  /** Bolinha ao lado do título. */
  dot: string;
  /** Filete no topo da coluna. */
  ring: string;
  /** Fundo do cabeçalho, bem translúcido. */
  header: string;
}

/**
 * As colunas, na ordem do fluxo. Fixas de propósito: o quadro é um fluxo de
 * trabalho, e o que varia por tarefa é a etiqueta. As cores foram pedidas assim:
 * Backlog cinza, Pendente vermelho, Fazendo azul, Testes amarelo, Finalizado verde.
 */
export const BOARD_COLUMNS: readonly BoardColumnDef[] = [
  {
    status: TASK_CARD_STATUS.Backlog,
    title: "Backlog",
    dot: "bg-zinc-400",
    ring: "border-t-zinc-400",
    header: "bg-zinc-400/10",
  },
  {
    status: TASK_CARD_STATUS.Pending,
    title: "Pendente",
    dot: "bg-red-500",
    ring: "border-t-red-500",
    header: "bg-red-500/10",
  },
  {
    status: TASK_CARD_STATUS.Doing,
    title: "Fazendo",
    dot: "bg-blue-500",
    ring: "border-t-blue-500",
    header: "bg-blue-500/10",
  },
  {
    status: TASK_CARD_STATUS.Testing,
    title: "Testes",
    dot: "bg-amber-400",
    ring: "border-t-amber-400",
    header: "bg-amber-400/10",
  },
  {
    status: TASK_CARD_STATUS.Done,
    title: "Finalizado",
    dot: "bg-emerald-500",
    ring: "border-t-emerald-500",
    header: "bg-emerald-500/10",
  },
];

/** Título da coluna pelo código, para badges fora do quadro (busca, arquivados). */
export function columnTitle(status: EnumValue): string {
  const code = statusCode(status);
  return BOARD_COLUMNS.find((c) => c.status === code)?.title ?? "—";
}

/** Normaliza o status que veio da API (nome ou número) para o código. */
export function statusCode(status: EnumValue): TaskCardStatusCode {
  return enumCode(status, TASK_CARD_STATUS) as TaskCardStatusCode;
}

/** Id do alvo de soltura de uma coluna no dnd-kit. Prefixado para não colidir com id de cartão. */
export function columnDropId(status: TaskCardStatusCode): string {
  return `column:${status}`;
}

/** O inverso de `columnDropId`; `undefined` para id que não é de coluna. */
export function parseColumnDropId(id: string | number): TaskCardStatusCode | undefined {
  if (typeof id !== "string" || !id.startsWith("column:")) return undefined;
  const code = Number(id.slice("column:".length));
  return BOARD_COLUMNS.some((c) => c.status === code) ? (code as TaskCardStatusCode) : undefined;
}

/** Espaço entre posições ao anexar no fim: sobra margem para muitas médias antes de renumerar. */
export const POSITION_STEP = 1024;

/**
 * Posição de um cartão solto entre dois vizinhos.
 *
 * Só o cartão movido é gravado — é por isso que a posição é um decimal e não um
 * índice: renumerar a coluna inteira a cada arrasto seria N escritas para uma
 * ação. Sem vizinhos, começa em `POSITION_STEP`; só com o anterior, soma o
 * passo; só com o próximo, fica na metade dele.
 */
export function positionBetween(prev?: number, next?: number): number {
  if (prev == null && next == null) return POSITION_STEP;
  if (prev == null) return next! / 2;
  if (next == null) return prev + POSITION_STEP;
  return (prev + next) / 2;
}

export type ColumnsMap = Record<TaskCardStatusCode, TaskCardSummaryDto[]>;

export function emptyColumns(): ColumnsMap {
  return {
    [TASK_CARD_STATUS.None]: [],
    [TASK_CARD_STATUS.Backlog]: [],
    [TASK_CARD_STATUS.Pending]: [],
    [TASK_CARD_STATUS.Doing]: [],
    [TASK_CARD_STATUS.Testing]: [],
    [TASK_CARD_STATUS.Done]: [],
  };
}

/** Agrupa por coluna e ordena por posição (desempate pelo id, como o servidor). */
export function groupByColumn(items: readonly TaskCardSummaryDto[]): ColumnsMap {
  const columns = emptyColumns();
  for (const item of items) columns[statusCode(item.status)].push(item);
  for (const list of Object.values(columns)) {
    list.sort((a, b) => a.position - b.position || a.id - b.id);
  }
  return columns;
}

/** A coluna em que um cartão está no mapa local, ou `undefined` se não está no quadro. */
export function findColumnOf(columns: ColumnsMap, cardId: number): TaskCardStatusCode | undefined {
  for (const column of BOARD_COLUMNS) {
    if (columns[column.status].some((c) => c.id === cardId)) return column.status;
  }
  return undefined;
}

/** Classes de uma etiqueta por chave da paleta: chip no cartão e amostra no seletor. */
export const LABEL_COLOR_CLASSES: Record<string, { chip: string; swatch: string }> = {
  green: { chip: "bg-green-600 text-white", swatch: "bg-green-600" },
  yellow: { chip: "bg-yellow-400 text-zinc-900", swatch: "bg-yellow-400" },
  orange: { chip: "bg-orange-500 text-white", swatch: "bg-orange-500" },
  red: { chip: "bg-red-600 text-white", swatch: "bg-red-600" },
  purple: { chip: "bg-purple-600 text-white", swatch: "bg-purple-600" },
  blue: { chip: "bg-blue-600 text-white", swatch: "bg-blue-600" },
  sky: { chip: "bg-sky-400 text-zinc-900", swatch: "bg-sky-400" },
  lime: { chip: "bg-lime-400 text-zinc-900", swatch: "bg-lime-400" },
  pink: { chip: "bg-pink-500 text-white", swatch: "bg-pink-500" },
  gray: { chip: "bg-zinc-500 text-white", swatch: "bg-zinc-500" },
};

export function labelClasses(color: string) {
  return LABEL_COLOR_CLASSES[color] ?? LABEL_COLOR_CLASSES.gray;
}

/** Rótulo de cada prioridade de etiqueta. */
export const LABEL_PRIORITY_LABEL: Record<number, string> = {
  [TASK_LABEL_PRIORITY.None]: "Sem prioridade",
  [TASK_LABEL_PRIORITY.Low]: "Baixa",
  [TASK_LABEL_PRIORITY.Normal]: "Normal",
  [TASK_LABEL_PRIORITY.High]: "Alta",
  [TASK_LABEL_PRIORITY.Urgent]: "Urgente",
};

export function priorityCode(priority: EnumValue): number {
  return enumCode(priority, TASK_LABEL_PRIORITY);
}

/** A maior prioridade entre as etiquetas do cartão; zero sem etiqueta. */
export function cardPriority(labels: readonly TaskLabelDto[]): number {
  return labels.reduce((max, label) => Math.max(max, priorityCode(label.priority)), 0);
}

const MEMBER_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-sky-500",
  "bg-indigo-500",
  "bg-fuchsia-500",
];

/** Cor estável do avatar de um usuário, derivada do id. */
export function memberColor(userId: number): string {
  return MEMBER_COLORS[Math.abs(userId) % MEMBER_COLORS.length];
}

/** "1,2 MB", "340 KB", "12 B". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

import {
  enumCode,
  TASK_CARD_PRIORITY,
  TASK_CARD_STATUS,
  type EnumValue,
  type TaskCardPriorityCode,
  type TaskCardSummaryDto,
} from "@workspace/api-client-react";

/**
 * Regras puras da lista de tarefas: situação, prioridade, ordem, filtro por pessoa
 * e a idade da tarefa. Sem React e sem rede, para os testes rodarem sem montar
 * nada. (Até 23/10/2026 a tela era um quadro de colunas; as regras de arrasto e
 * posição saíram com ele.)
 */

/** Código numérico da situação, venha ela pelo nome ("Done") ou pelo número. */
export function statusCode(status: EnumValue): number {
  return enumCode(status, TASK_CARD_STATUS);
}

export function isDone(status: EnumValue): boolean {
  return statusCode(status) === TASK_CARD_STATUS.Done;
}

/**
 * Nome e bolinha de cada situação, para o selo do detalhe e as linhas do
 * histórico. Backlog, Fazendo e Testes só aparecem no histórico anterior a
 * 23/10/2026 ("moveu de Fazendo para Testes") e ficam com as cores do quadro.
 */
export const STATUS_BADGES: Record<number, { title: string; dot: string }> = {
  [TASK_CARD_STATUS.Backlog]: { title: "Backlog", dot: "bg-zinc-400" },
  [TASK_CARD_STATUS.Pending]: { title: "Pendente", dot: "bg-amber-500" },
  [TASK_CARD_STATUS.Doing]: { title: "Fazendo", dot: "bg-blue-500" },
  [TASK_CARD_STATUS.Testing]: { title: "Testes", dot: "bg-yellow-400" },
  [TASK_CARD_STATUS.Done]: { title: "Finalizado", dot: "bg-emerald-500" },
};

/** Uma prioridade como a tela a pinta. A cor vem sempre com o ícone e o nome. */
export interface PriorityDef {
  code: TaskCardPriorityCode;
  name: string;
  /** Texto e ícone do selo. */
  text: string;
  /** Fundo do selo. */
  soft: string;
  /** A faixa colorida à esquerda do cartão. */
  stripe: string;
  /** O botão escolhido no seletor. */
  selected: string;
}

/**
 * As quatro prioridades, da mais urgente para a menos — a ordem da lista e do
 * seletor. Urgente em vermelho e Alta em âmbar falam o vocabulário de cores da
 * base (negativo e atenção); Normal e Baixa ficam neutras, para a lista não virar
 * um arco-íris em que nada se destaca.
 */
export const PRIORITIES: readonly PriorityDef[] = [
  {
    code: TASK_CARD_PRIORITY.Urgent,
    name: "Urgente",
    text: "text-red-400",
    soft: "bg-red-500/15",
    stripe: "border-l-red-500",
    selected: "border-red-500 bg-red-500/15 text-red-400",
  },
  {
    code: TASK_CARD_PRIORITY.High,
    name: "Alta",
    text: "text-amber-400",
    soft: "bg-amber-500/15",
    stripe: "border-l-amber-500",
    selected: "border-amber-500 bg-amber-500/15 text-amber-400",
  },
  {
    code: TASK_CARD_PRIORITY.Normal,
    name: "Normal",
    text: "text-slate-300",
    soft: "bg-slate-500/20",
    stripe: "border-l-slate-400",
    selected: "border-slate-400 bg-slate-500/20 text-slate-200",
  },
  {
    code: TASK_CARD_PRIORITY.Low,
    name: "Baixa",
    text: "text-slate-400",
    soft: "bg-slate-500/10",
    stripe: "border-l-slate-600",
    selected: "border-slate-500 bg-slate-500/10 text-slate-300",
  },
];

/** Código numérico da prioridade, venha ela pelo nome ("High") ou pelo número. */
export function priorityCode(priority: EnumValue): number {
  return enumCode(priority, TASK_CARD_PRIORITY);
}

/** A definição da prioridade; valor desconhecido (servidor mais novo que a tela) é Normal. */
export function priorityDef(priority: EnumValue): PriorityDef {
  const code = priorityCode(priority);
  return PRIORITIES.find((p) => p.code === code) ?? PRIORITIES[2];
}

/** O que a lista mostra: as pendentes ou as finalizadas. */
export type TaskView = "pending" | "done";

/**
 * De quem são as tarefas mostradas: as do usuário logado (o padrão, pedido do dono
 * em 23/10/2026), as de todos, ou as de uma pessoa (o id dela).
 */
export type WhoFilter = "mine" | "all" | number;

/**
 * A tarefa é de quem o filtro pede? Sem responsável (tarefa migrada sem ninguém)
 * só aparece em "todas" — não é de pessoa nenhuma. Sem sessão carregada, "minhas"
 * não tem nada.
 */
export function matchesWho(
  card: Pick<TaskCardSummaryDto, "assignee">,
  who: WhoFilter,
  meId: number | null,
): boolean {
  if (who === "all") return true;
  const assignee = card.assignee?.userId ?? null;
  if (assignee === null) return false;
  if (who === "mine") return meId !== null && assignee === meId;
  return assignee === who;
}

function compareText(a: string | null | undefined, b: string | null | undefined): number {
  const x = a ?? "";
  const y = b ?? "";
  return x < y ? -1 : x > y ? 1 : 0;
}

/**
 * Pendentes: a mais urgente primeiro e, na mesma prioridade, a que espera há mais
 * tempo — a mesma ordem do servidor. As datas da API são texto ordenável.
 */
export function sortPending(items: readonly TaskCardSummaryDto[]): TaskCardSummaryDto[] {
  return [...items].sort(
    (a, b) =>
      priorityCode(b.priority) - priorityCode(a.priority) ||
      compareText(a.createdAt, b.createdAt) ||
      a.id - b.id,
  );
}

/** Finalizadas: a concluída por último primeiro. */
export function sortDone(items: readonly TaskCardSummaryDto[]): TaskCardSummaryDto[] {
  return [...items].sort((a, b) => compareText(b.finishedAt, a.finishedAt) || b.id - a.id);
}

/** As tarefas da situação e da pessoa pedidas, na ordem da lista. */
export function visibleTasks(
  items: readonly TaskCardSummaryDto[],
  view: TaskView,
  who: WhoFilter,
  meId: number | null,
): TaskCardSummaryDto[] {
  const picked = items.filter((c) => isDone(c.status) === (view === "done") && matchesWho(c, who, meId));
  return view === "done" ? sortDone(picked) : sortPending(picked);
}

/** Quantas tarefas da situação pedida são de quem o filtro diz. */
export function countTasks(
  items: readonly TaskCardSummaryDto[],
  view: TaskView,
  who: WhoFilter,
  meId: number | null,
): number {
  return items.filter((c) => isDone(c.status) === (view === "done") && matchesWho(c, who, meId)).length;
}

// ---------------------------------------------------------------------------
// Datas: "há 2 dias", "hoje às 10:12"
// ---------------------------------------------------------------------------

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A data como a API a devolve: hora de Brasília SEM fuso declarado. */
const API_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/**
 * A data da API em milissegundos de "relógio de parede" de Brasília, lida em UTC.
 * Lida pelo `new Date()` puro, ela seria tomada como hora do APARELHO, e a idade
 * sairia deslocada em qualquer máquina fora de Brasília — inclusive no CI, que
 * roda em UTC (armadilha 8 do CLAUDE.md).
 */
function wallClockMs(value: string): number {
  return new Date(API_TIMESTAMP.test(value) ? `${value}Z` : value).getTime();
}

/** Agora, no relógio de parede de Brasília, na mesma régua de `wallClockMs`. */
export function brasiliaNowMs(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

/** Dias de calendário entre a data e agora (0 = hoje, 1 = ontem). */
function calendarDays(thenMs: number, nowMs: number): number {
  return Math.floor(nowMs / DAY) - Math.floor(thenMs / DAY);
}

/**
 * Há quanto tempo, como se fala: "agora", "há 20 min", "há 3 h", "ontem", "há 4
 * dias", "há 2 semanas", "há 3 meses". "Ontem" é o dia de calendário, não 24 h:
 * a anotação das 23h vista às 8h é de ontem.
 */
export function relativeAge(value: string, nowMs: number = brasiliaNowMs()): string {
  const then = wallClockMs(value);
  if (Number.isNaN(then)) return "";

  const diff = nowMs - then;
  const days = calendarDays(then, nowMs);

  if (diff < MINUTE) return "agora";
  if (diff < HOUR) return `há ${Math.floor(diff / MINUTE)} min`;
  if (days <= 0) return `há ${Math.floor(diff / HOUR)} h`;
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? "há 1 semana" : `há ${weeks} semanas`;
  }
  const months = Math.floor(days / 30);
  return months === 1 ? "há 1 mês" : `há ${months} meses`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "hoje às 10:12", "ontem às 16:40", "20/10 às 11:05"; de outro ano, "20/10/2025". */
export function formatWhen(value: string, nowMs: number = brasiliaNowMs()): string {
  const then = wallClockMs(value);
  if (Number.isNaN(then)) return "";

  const d = new Date(then);
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  const days = calendarDays(then, nowMs);

  if (days === 0) return `hoje às ${time}`;
  if (days === 1) return `ontem às ${time}`;

  const date = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
  return new Date(nowMs).getUTCFullYear() === d.getUTCFullYear()
    ? `${date} às ${time}`
    : `${date}/${d.getUTCFullYear()}`;
}

/** O primeiro nome de um nome completo ("Ana Souza" → "Ana"). */
export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? "").trim().split(/\s+/)[0] ?? "";
}

// ---------------------------------------------------------------------------
// Etiquetas, avatares, anexos
// ---------------------------------------------------------------------------

/** Classes de uma etiqueta por chave da paleta: chip na tarefa e amostra no seletor. */
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

/**
 * Cor estável do avatar de um usuário, derivada do id: a mesma pessoa tem a
 * mesma cor na lista, no detalhe e na atividade.
 */
const MEMBER_COLORS = [
  "bg-rose-500",
  "bg-orange-500",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-teal-600",
  "bg-sky-600",
  "bg-indigo-500",
  "bg-fuchsia-600",
];

export function memberColor(userId: number): string {
  return MEMBER_COLORS[Math.abs(userId) % MEMBER_COLORS.length];
}

/** "1,2 MB", "340 KB", "12 B". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

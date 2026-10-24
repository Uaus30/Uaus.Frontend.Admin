import { Search, UserRound, X } from "lucide-react";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@workspace/ui";
import type { TaskCardMemberDto } from "@workspace/api-client-react";
import type { TaskView, WhoFilter } from "../tasks";

interface TaskTabsProps {
  view: TaskView;
  onChange: (view: TaskView) => void;
  pendingCount: number;
  doneCount: number;
  /** "para você", "de todos", "de Rafael" — de quem são as pendentes contadas. */
  whoLabel: string;
  finishedWindowDays: number;
}

/**
 * As duas situações em abas grandes, com o número em destaque: é a primeira coisa
 * que a tela responde ("quanto falta?"). O número das finalizadas é verde — o
 * positivo do vocabulário de cores —, e o das pendentes, o laranja do tema.
 */
export function TaskTabs({
  view,
  onChange,
  pendingCount,
  doneCount,
  whoLabel,
  finishedWindowDays,
}: TaskTabsProps) {
  const tab = (value: TaskView, count: number, title: string, hint: string, tone: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === value}
      onClick={() => onChange(value)}
      className={cn(
        "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/40 sm:gap-4 sm:px-5",
        view === value && "border-primary bg-primary/5 ring-1 ring-inset ring-primary",
      )}
    >
      <span className={cn("text-2xl font-bold tabular-nums leading-none sm:text-3xl", tone)}>{count}</span>
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );

  return (
    <div role="tablist" aria-label="Situação" className="grid grid-cols-2 gap-3">
      {tab("pending", pendingCount, "Pendentes", whoLabel, "text-primary")}
      {tab("done", doneCount, "Finalizadas", `últimos ${finishedWindowDays} dias`, "text-emerald-400")}
    </div>
  );
}

interface TaskFiltersProps {
  who: WhoFilter;
  onWhoChange: (who: WhoFilter) => void;
  users: TaskCardMemberDto[];
  meId: number | null;
  /** Quantas tarefas da aba aberta cada filtro tem. */
  countFor: (who: WhoFilter) => number;
  search: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
}

/** O valor do Select é texto; "mine" e "all" ficam como estão, a pessoa vira o id. */
function toValue(who: WhoFilter): string {
  return typeof who === "number" ? String(who) : who;
}

function fromValue(value: string): WhoFilter {
  return value === "mine" || value === "all" ? value : Number(value);
}

/**
 * "Tarefas de: Marina (eu)" e a busca. A busca vai ao servidor (acha na solução,
 * nos comentários e nas finalizadas antigas); de quem e a aba continuam valendo
 * sobre o resultado.
 */
export function TaskFilters(props: TaskFiltersProps) {
  const { who, onWhoChange, users, meId, countFor, search, onSearchChange, onSearchClear } = props;
  const me = users.find((u) => u.userId === meId);
  const others = users.filter((u) => u.userId !== meId);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      {/* O rótulo fica FORA do gatilho: o SelectTrigger corta o filho direto em uma
          linha (`[&>span]:line-clamp-1`), e um rótulo dentro dele quebrava a linha
          e escondia o fim da contagem ("· 1" no lugar de "· 11"). */}
      <div className="flex items-center gap-2">
        <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
          <UserRound className="h-4 w-4" aria-hidden /> Tarefas de
        </span>
        <Select value={toValue(who)} onValueChange={(value) => onWhoChange(fromValue(value))}>
          <SelectTrigger
            aria-label="Tarefas de quem"
            className="h-10 min-w-0 flex-1 font-semibold sm:w-56 sm:flex-none"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">
              {me ? `${me.firstName} (eu)` : "Minhas"} · {countFor("mine")}
            </SelectItem>
            <SelectItem value="all">Todas as pessoas · {countFor("all")}</SelectItem>
            {others.map((u) => (
              <SelectItem key={u.userId} value={String(u.userId)}>
                {u.firstName} · {countFor(u.userId)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="relative min-w-0 flex-1 sm:max-w-sm sm:ml-auto">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onSearchClear()}
          placeholder="Buscar (#12, título, solução…)"
          aria-label="Buscar tarefas"
          className="h-10 pl-9 pr-9"
        />
        {search && (
          <button
            type="button"
            onClick={onSearchClear}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

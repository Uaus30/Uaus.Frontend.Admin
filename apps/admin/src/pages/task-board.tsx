import { useState } from "react";
import { CircleCheckBig, ListTodo, Loader2, Plus, Tags } from "lucide-react";
import { Button } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { useTaskList } from "@/features/task-board/hooks/useTaskList";
import { TaskListCard } from "@/features/task-board/components/TaskListCard";
import { TaskFilters, TaskTabs } from "@/features/task-board/components/TaskListFilters";
import { TaskCardDialog } from "@/features/task-board/components/TaskCardDialog";
import { NewTaskDialog } from "@/features/task-board/components/NewTaskDialog";
import { TaskLabelsDialog } from "@/features/task-board/components/TaskLabelsDialog";
import type { TaskListController } from "@/features/task-board/hooks/useTaskList";

/**
 * Página das tarefas (rota `/tarefas`): a lista de anotações do que falta fazer,
 * da mais urgente para a menos, com o botão grande de concluir em cada uma. Foi o
 * "Modelo B" que o dono escolheu em 23/10/2026, no lugar do quadro de colunas.
 *
 * Abre nas tarefas de quem está logado; o filtro mostra as de todos ou de uma
 * pessoa. Os dados e as ações moram em `useTaskList`.
 */
export default function TaskBoardPage() {
  const list = useTaskList();
  const [labelsOpen, setLabelsOpen] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" />
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Tarefas</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Anotações do que falta fazer, da mais urgente para a menos.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" className="gap-1.5" onClick={() => setLabelsOpen(true)}>
            <Tags className="h-4 w-4" /> Etiquetas
          </Button>
          <Button type="button" size="lg" className="flex-1 gap-1.5 sm:flex-none" onClick={list.openNew}>
            <Plus className="h-5 w-5" /> Nova tarefa
          </Button>
        </div>
      </div>

      <TaskTabs
        view={list.view}
        onChange={list.setView}
        pendingCount={list.pendingCount}
        doneCount={list.doneCount}
        whoLabel={whoLabel(list)}
        finishedWindowDays={list.finishedWindowDays}
      />

      <TaskFilters
        who={list.who}
        onWhoChange={list.setWho}
        users={list.users}
        meId={list.meId}
        countFor={list.countFor}
        search={list.search.input}
        onSearchChange={list.search.setInput}
        onSearchClear={list.search.clear}
      />

      <TaskListBody list={list} />

      <TaskCardDialog
        cardId={list.selectedCardId}
        onClose={list.closeCard}
        onComplete={list.complete}
        onReopen={list.reopen}
        isMoving={list.isMoving}
        onDelete={list.deleteCard}
        onManageLabels={() => setLabelsOpen(true)}
        isDeleting={list.isDeleting}
      />

      <NewTaskDialog
        open={list.isNewOpen}
        onClose={list.closeNew}
        users={list.users}
        meId={list.meId}
        onCreate={list.createTask}
        isCreating={list.isCreating}
      />

      <TaskLabelsDialog open={labelsOpen} onClose={() => setLabelsOpen(false)} />
    </div>
  );
}

/** "para você", "de todos", "de Rafael" — embaixo do número de pendentes. */
function whoLabel(list: TaskListController): string {
  if (list.who === "mine") return "para você";
  if (list.who === "all") return "de todos";
  const user = list.users.find((u) => u.userId === list.who);
  return user ? `de ${user.firstName}` : "de uma pessoa";
}

function TaskListBody({ list }: { list: TaskListController }) {
  if (list.isLoading) {
    return (
      <p className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando as tarefas…
      </p>
    );
  }

  if (list.isError) {
    return (
      <p className="rounded-lg border border-destructive/40 px-4 py-3 text-sm text-destructive">
        Não foi possível carregar as tarefas. {describeApiError(list.error)}
      </p>
    );
  }

  const searching = list.search.isActive;

  if (list.visible.length === 0) {
    if (searching) {
      return (
        <EmptyState
          title={list.search.isSearching ? "Buscando…" : "Nada encontrado"}
          text={
            list.search.isSearching ? undefined : `Nenhuma tarefa com “${list.search.input.trim()}” aqui.`
          }
          action={{ label: "Limpar busca", onClick: list.search.clear }}
        />
      );
    }
    if (list.view === "done") {
      return <EmptyState text={`Nenhuma tarefa finalizada nos últimos ${list.finishedWindowDays} dias.`} />;
    }
    return (
      <EmptyState
        icon
        title="Tudo em dia!"
        text={list.who === "mine" ? "Nenhuma tarefa pendente para você." : "Nenhuma tarefa pendente aqui."}
        action={
          list.who === "all"
            ? undefined
            : { label: "Ver as tarefas de todos", onClick: () => list.setWho("all") }
        }
      />
    );
  }

  const showOlder = list.view === "done" && !searching && !list.allFinished && list.hiddenFinishedCount > 0;

  return (
    <div className="space-y-3">
      {list.visible.map((card) => (
        <TaskListCard
          key={card.id}
          card={card}
          meId={list.meId}
          completing={list.completing.has(card.id)}
          onOpen={list.openCard}
          onComplete={list.complete}
          onReopen={list.reopen}
        />
      ))}
      {showOlder && (
        <p className="pt-1 text-center text-sm text-muted-foreground">
          Mostrando as finalizadas dos últimos {list.finishedWindowDays} dias.{" "}
          <button
            type="button"
            className="font-semibold text-primary hover:underline"
            onClick={list.showAllFinished}
          >
            Ver as {list.hiddenFinishedCount} mais antigas
          </button>
        </p>
      )}
    </div>
  );
}

function EmptyState(props: {
  icon?: boolean;
  title?: string;
  text?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-2xl border border-dashed px-4 py-14 text-center text-muted-foreground">
      {props.icon && <CircleCheckBig className="mx-auto mb-3 h-14 w-14 text-emerald-500" aria-hidden />}
      {props.title && <h3 className="mb-1 text-lg font-semibold text-foreground">{props.title}</h3>}
      {props.text && <p>{props.text}</p>}
      {props.action && (
        <Button type="button" variant="outline" className="mt-4" onClick={props.action.onClick}>
          {props.action.label}
        </Button>
      )}
    </div>
  );
}

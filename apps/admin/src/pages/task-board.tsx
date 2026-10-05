import { useState } from "react";
import { Archive, Loader2, SquareKanban, Tags } from "lucide-react";
import { Button } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { useTaskBoard } from "@/features/task-board/hooks/useTaskBoard";
import { useTaskSearch } from "@/features/task-board/hooks/useTaskSearch";
import { TaskBoard } from "@/features/task-board/components/TaskBoard";
import { TaskSearchBox } from "@/features/task-board/components/TaskSearchBox";
import { TaskCardDialog } from "@/features/task-board/components/TaskCardDialog";
import { TaskLabelsDialog } from "@/features/task-board/components/TaskLabelsDialog";
import { ArchivedCardsSheet } from "@/features/task-board/components/ArchivedCardsSheet";
import boardBackground from "@/features/task-board/assets/board-background.webp";

/**
 * Página do quadro de tarefas (rota `/tarefas`).
 *
 * A rota é `fullBleed` (ver `routes.ts`): o layout entrega o `<main>` sem
 * padding, sem largura máxima e com altura definida, e o quadro é a única tela
 * que quer a imagem de fundo encostada nas bordas, como no Trello. O que rola é
 * a coluna (por dentro) e o quadro (de lado) — a página em si não rola.
 */
export default function TaskBoardPage() {
  const board = useTaskBoard();
  const search = useTaskSearch();
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);

  return (
    <div
      className="flex h-full flex-col overflow-hidden bg-cover bg-center"
      style={{ backgroundImage: `url(${boardBackground})` }}
    >
      <header className="flex flex-col gap-2 border-b border-white/10 bg-background/55 px-3 py-2.5 backdrop-blur-md sm:flex-row sm:items-center sm:gap-3 sm:px-5">
        <div className="flex items-center gap-2">
          <SquareKanban className="h-5 w-5 text-primary" />
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">Tarefas</h1>
        </div>

        <div className="min-w-0 flex-1 sm:max-w-xl">
          <TaskSearchBox
            value={search.input}
            onChange={search.setInput}
            onClear={search.clear}
            isActive={search.isActive}
            isSearching={search.isSearching}
            results={search.results}
            onOpen={board.openCard}
          />
        </div>

        <div className="flex items-center gap-1.5 sm:ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 bg-background/40 backdrop-blur"
            onClick={() => setLabelsOpen(true)}
          >
            <Tags className="h-4 w-4" /> Etiquetas
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 bg-background/40 backdrop-blur"
            onClick={() => setArchivedOpen(true)}
          >
            <Archive className="h-4 w-4" /> Arquivados
          </Button>
        </div>
      </header>

      <div className="board-scroll min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-3 py-3 sm:px-5 sm:py-4">
        {board.isLoading ? (
          <div className="flex items-center gap-2 rounded-lg bg-background/70 px-4 py-3 text-sm text-muted-foreground backdrop-blur">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando o quadro…
          </div>
        ) : board.isError ? (
          <div className="rounded-lg bg-background/80 px-4 py-3 text-sm text-destructive backdrop-blur">
            Não foi possível carregar o quadro. {describeApiError(board.error)}
          </div>
        ) : (
          <TaskBoard board={board} />
        )}
      </div>

      <TaskCardDialog
        cardId={board.selectedCardId}
        onClose={board.closeCard}
        onMove={board.moveCardToColumn}
        onFinish={board.finishCard}
        isMoving={board.isMoving}
        onArchive={board.archiveCard}
        onUnarchive={board.unarchiveCard}
        onDelete={board.deleteCard}
        onManageLabels={() => setLabelsOpen(true)}
        isArchiving={board.isArchiving}
        isDeleting={board.isDeleting}
      />

      <TaskLabelsDialog open={labelsOpen} onClose={() => setLabelsOpen(false)} />

      <ArchivedCardsSheet
        open={archivedOpen}
        onClose={() => setArchivedOpen(false)}
        onOpenCard={(id) => {
          setArchivedOpen(false);
          board.openCard(id);
        }}
        onUnarchive={board.unarchiveCard}
        isUnarchiving={board.isArchiving}
      />
    </div>
  );
}

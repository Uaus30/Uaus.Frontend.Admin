import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { BOARD_COLUMNS } from "../board";
import type { TaskBoardController } from "../hooks/useTaskBoard";
import { BoardColumn } from "./BoardColumn";
import { TaskCardContent } from "./TaskCardItem";

interface TaskBoardProps {
  board: TaskBoardController;
}

/**
 * As cinco colunas com o arrasto por cima.
 *
 * Três sensores, e não o `PointerSensor` sozinho: no celular o dedo que toca um
 * cartão quase sempre quer ROLAR a coluna, então o arrasto por toque só começa
 * depois de segurar 250ms sem mover (o gesto do Trello). No mouse, 6px de
 * movimento bastam — e um clique sem movimento continua abrindo o cartão. O
 * teclado entra por acessibilidade: espaço pega, setas movem, espaço solta.
 */
export function TaskBoard({ board }: TaskBoardProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    board.beginDrag(Number(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    if (event.over) board.dragOver(Number(event.active.id), event.over.id);
  }

  function handleDragEnd(event: DragEndEvent) {
    board.endDrag(Number(event.active.id), event.over?.id ?? null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={board.cancelDrag}
    >
      <div className="flex h-full snap-x snap-mandatory items-start gap-3 sm:gap-4">
        {BOARD_COLUMNS.map((column) => (
          <BoardColumn
            key={column.status}
            column={column}
            cards={board.columns[column.status]}
            onOpen={board.openCard}
            onAdd={(title) => board.createCard(title, column.status)}
            isAdding={board.isCreating}
            hiddenFinishedCount={board.hiddenFinishedCount}
            finishedWindowDays={board.finishedWindowDays}
            allFinished={board.allFinished}
            onToggleAllFinished={board.setAllFinished}
          />
        ))}
        {/* Folga no fim para a última coluna não encostar na borda ao rolar de lado. */}
        <div className="w-1 shrink-0" aria-hidden />
      </div>

      <DragOverlay dropAnimation={null}>
        {board.activeCard && (
          <div className="w-[85vw] sm:w-72">
            <TaskCardContent card={board.activeCard} overlay />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

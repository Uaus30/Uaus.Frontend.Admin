import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { TASK_CARD_STATUS, type TaskCardSummaryDto } from "@workspace/api-client-react";
import { cn } from "@workspace/ui";
import { columnDropId, type BoardColumnDef } from "../board";
import { QuickAddCard } from "./QuickAddCard";
import { SortableTaskCard } from "./TaskCardItem";

interface BoardColumnProps {
  column: BoardColumnDef;
  cards: TaskCardSummaryDto[];
  onOpen: (cardId: number) => void;
  onAdd: (title: string) => Promise<unknown>;
  isAdding: boolean;
  /** Só na coluna Finalizado: quantos ficaram de fora da janela e o controle para mostrá-los. */
  hiddenFinishedCount?: number;
  finishedWindowDays?: number;
  allFinished?: boolean;
  onToggleAllFinished?: (value: boolean) => void;
}

/**
 * Uma coluna do quadro: cabeçalho com a cor da etapa, a lista rolável de
 * cartões (alvo de soltura) e o "+ Adicionar um cartão".
 *
 * A largura é `85vw` no celular — uma coluna por tela, com a próxima aparecendo
 * na borda para convidar a rolar de lado — e fixa no desktop. A altura é
 * limitada pela tela: a coluna rola por dentro, e o quadro só rola de lado.
 */
export function BoardColumn({
  column,
  cards,
  onOpen,
  onAdd,
  isAdding,
  hiddenFinishedCount = 0,
  finishedWindowDays = 30,
  allFinished = false,
  onToggleAllFinished,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(column.status) });
  const isDone = column.status === TASK_CARD_STATUS.Done;

  return (
    <section
      aria-label={column.title}
      className={cn(
        // `overflow-hidden` recorta o cabeçalho na curva do canto: sem isso a
        // tinta dele vazava por cima da borda e da sombra da coluna.
        "flex max-h-full w-[85vw] shrink-0 snap-center flex-col overflow-hidden rounded-xl border border-border/50 bg-background/75 shadow-lg backdrop-blur-md sm:w-72",
        isOver && "ring-2 ring-primary/50",
      )}
    >
      <header className={cn("flex items-center gap-2 border-t-4 px-3 py-2.5", column.ring, column.header)}>
        <span className={cn("h-2.5 w-2.5 rounded-full", column.dot)} />
        <h2 className="text-sm font-semibold text-foreground">{column.title}</h2>
        <span className="ml-auto rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {cards.length}
        </span>
      </header>

      <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2 py-2">
          {cards.map((card) => (
            <SortableTaskCard key={card.id} card={card} onOpen={onOpen} />
          ))}
          {cards.length === 0 && (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
              Solte um cartão aqui
            </p>
          )}

          {isDone && onToggleAllFinished && (hiddenFinishedCount > 0 || allFinished) && (
            <button
              type="button"
              onClick={() => onToggleAllFinished(!allFinished)}
              className="w-full rounded-lg px-2 py-1.5 text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {allFinished
                ? `Mostrar só os últimos ${finishedWindowDays} dias`
                : `Mostrar todos (${hiddenFinishedCount} ${hiddenFinishedCount === 1 ? "oculto" : "ocultos"} há mais de ${finishedWindowDays} dias)`}
            </button>
          )}
        </div>
      </SortableContext>

      <footer className="px-2 pb-2 pt-1">
        <QuickAddCard columnTitle={column.title} onAdd={onAdd} isAdding={isAdding} />
      </footer>
    </section>
  );
}

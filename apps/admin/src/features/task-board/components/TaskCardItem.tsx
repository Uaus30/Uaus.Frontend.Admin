import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlignLeft, Paperclip, SquareCheckBig } from "lucide-react";
import { cn } from "@workspace/ui";
import type { TaskCardSummaryDto } from "@workspace/api-client-react";
import { MemberStack, TaskLabelChip } from "./CardBits";

interface TaskCardContentProps {
  card: TaskCardSummaryDto;
  /** Versão que acompanha o ponteiro durante o arrasto. */
  overlay?: boolean;
  /** O original enquanto a cópia está sendo arrastada: fica como "buraco". */
  ghost?: boolean;
  onOpen?: (cardId: number) => void;
}

/**
 * O cartão como o quadro o desenha: etiquetas em cima, título com o número, e
 * no rodapé os sinais do que ele carrega (descrição, checklist, anexos) e os
 * membros. Puro: recebe o cartão e um clique.
 *
 * O visual translúcido (`bg-card/90` + `backdrop-blur`) é o que deixa o fundo
 * do quadro aparecer sem prejudicar a leitura do título — pedido do dono.
 */
export function TaskCardContent({ card, overlay, ghost, onOpen }: TaskCardContentProps) {
  const checklistComplete = card.checklistTotal > 0 && card.checklistDone === card.checklistTotal;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen?.(card.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(card.id);
        }
      }}
      className={cn(
        "group/card flex w-full cursor-pointer flex-col gap-2 rounded-lg border border-border/60 bg-card/90 p-2.5 text-left shadow-sm backdrop-blur transition-[box-shadow,transform,border-color]",
        "hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        overlay && "rotate-2 scale-[1.03] cursor-grabbing shadow-2xl ring-2 ring-primary/60",
        ghost && "opacity-40",
      )}
    >
      {card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <TaskLabelChip key={label.id} label={label} size="sm" />
          ))}
        </div>
      )}

      <p className="text-sm font-medium leading-snug text-foreground">
        <span className="mr-1.5 font-mono text-xs text-muted-foreground">#{card.number}</span>
        {card.title}
      </p>

      {(card.hasDescription ||
        card.checklistTotal > 0 ||
        card.attachmentsCount > 0 ||
        card.members.length > 0) && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
            {card.hasDescription && <AlignLeft className="h-3.5 w-3.5" aria-label="Tem descrição" />}
            {card.checklistTotal > 0 && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1 py-0.5",
                  checklistComplete && "bg-emerald-600 text-white",
                )}
              >
                <SquareCheckBig className="h-3.5 w-3.5" />
                {card.checklistDone}/{card.checklistTotal}
              </span>
            )}
            {card.attachmentsCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5" />
                {card.attachmentsCount}
              </span>
            )}
          </div>
          <MemberStack members={card.members} />
        </div>
      )}
    </div>
  );
}

interface SortableTaskCardProps {
  card: TaskCardSummaryDto;
  onOpen: (cardId: number) => void;
}

/**
 * O cartão arrastável. `touch-action: manipulation` deixa a lista rolar com o
 * dedo; o arrasto no celular só começa depois de segurar (ver os sensores em
 * `TaskBoard`), e a partir daí o dnd-kit bloqueia a rolagem.
 */
export function SortableTaskCard({ card, onOpen }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: "manipulation" }}
      {...attributes}
      {...listeners}
    >
      <TaskCardContent card={card} ghost={isDragging} onOpen={onOpen} />
    </div>
  );
}

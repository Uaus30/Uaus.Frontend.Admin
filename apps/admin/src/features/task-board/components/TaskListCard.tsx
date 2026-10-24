import { Check, CircleCheckBig, Clock, Paperclip, RotateCcw } from "lucide-react";
import { cn } from "@workspace/ui";
import type { TaskCardSummaryDto } from "@workspace/api-client-react";
import { firstName, formatWhen, isDone, priorityDef, relativeAge } from "../tasks";
import { MemberAvatar, PriorityBadge, TaskLabelChip } from "./CardBits";

interface TaskListCardProps {
  card: TaskCardSummaryDto;
  /** O usuário logado: a tarefa dele diz "Para você". */
  meId: number | null;
  /** Acabou de ser concluída: mostra o ✓ verde e o título riscado antes de sair. */
  completing?: boolean;
  disabled?: boolean;
  onOpen: (cardId: number) => void;
  onComplete: (card: TaskCardSummaryDto) => void;
  onReopen: (card: TaskCardSummaryDto) => void;
}

/**
 * Uma tarefa da lista (o "Modelo B" que o dono escolheu em 23/10/2026): o
 * conteúdo à esquerda — prioridade, número, idade, título, o começo da descrição,
 * para quem e as etiquetas — e, à direita, o botão grande de concluir. No celular
 * o botão vira uma barra larga embaixo, no alcance do polegar.
 *
 * A faixa colorida da esquerda é a prioridade (sempre com o selo de ícone e nome
 * no topo); na finalizada, ela fica verde e o botão vira "Reabrir".
 *
 * Puro: recebe a tarefa e os cliques. Clicar no conteúdo abre o detalhe; o botão
 * é irmão do conteúdo, não filho, para concluir não abrir a tarefa junto.
 */
export function TaskListCard({
  card,
  meId,
  completing,
  disabled,
  onOpen,
  onComplete,
  onReopen,
}: TaskListCardProps) {
  const done = isDone(card.status);
  const def = priorityDef(card.priority);
  const assignee = card.assignee ?? null;
  const author = card.createdBy && card.createdBy !== assignee?.fullName ? firstName(card.createdBy) : null;

  return (
    <article
      data-testid="task-card"
      aria-label={`Tarefa #${card.number}: ${card.title}`}
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-l-[5px] bg-card transition-opacity sm:flex-row",
        done ? "border-l-emerald-500" : def.stripe,
      )}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(card.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen(card.id);
          }
        }}
        className="min-w-0 flex-1 cursor-pointer px-4 py-3.5 text-left hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none sm:px-5 sm:py-4"
      >
        <div className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
          {done ? (
            <span className="inline-flex h-[22px] items-center gap-1 rounded-md bg-emerald-500/15 pl-1.5 pr-2 font-bold text-emerald-400">
              <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> Finalizada
            </span>
          ) : (
            <PriorityBadge priority={card.priority} />
          )}
          <span className="font-mono">#{card.number}</span>
          {done && card.finishedAt ? (
            <span>
              {formatWhen(card.finishedAt)}
              {card.finishedBy ? `, por ${firstName(card.finishedBy)}` : ""}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1" title="Anotada">
              <Clock className="h-3.5 w-3.5" aria-hidden /> {relativeAge(card.createdAt)}
            </span>
          )}
          {card.attachmentsCount > 0 && (
            <span className="inline-flex items-center gap-1" title="Anexos">
              <Paperclip className="h-3.5 w-3.5" aria-hidden /> {card.attachmentsCount}
            </span>
          )}
        </div>

        <h3
          className={cn(
            "text-base font-semibold leading-snug text-foreground sm:text-[17px]",
            completing && "text-muted-foreground line-through",
            done && "text-foreground/80",
          )}
        >
          {card.title}
        </h3>

        {!done && card.descriptionPreview && (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{card.descriptionPreview}</p>
        )}
        {done && card.solutionPreview && (
          <p className="mt-2 line-clamp-2 rounded-md bg-emerald-500/10 px-2.5 py-1.5 text-[13px] text-emerald-100/90">
            <span className="font-semibold">Solução:</span> {card.solutionPreview}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[13px] text-foreground/85">
          {assignee ? (
            <span className="inline-flex items-center gap-2">
              <MemberAvatar member={assignee} size="sm" />
              <span>{assignee.userId === meId ? "Para você" : `Para ${assignee.firstName}`}</span>
            </span>
          ) : (
            <span className="font-medium text-amber-400">Sem responsável</span>
          )}
          {author && <span className="text-muted-foreground">· anotada por {author}</span>}
          {card.labels.length > 0 && (
            <span className="flex flex-wrap gap-1 sm:ml-auto">
              {card.labels.map((label) => (
                <TaskLabelChip key={label.id} label={label} size="sm" />
              ))}
            </span>
          )}
        </div>
      </div>

      {done ? (
        <button
          type="button"
          onClick={() => onReopen(card)}
          disabled={disabled}
          aria-label={`Reabrir a tarefa #${card.number}`}
          className="flex h-14 shrink-0 items-center justify-center gap-2 border-t text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50 sm:h-auto sm:w-[104px] sm:flex-col sm:border-l sm:border-t-0 sm:text-xs"
        >
          <RotateCcw className="h-5 w-5" aria-hidden /> Reabrir
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onComplete(card)}
          disabled={disabled || completing}
          aria-label={`Concluir a tarefa #${card.number}`}
          className={cn(
            "group/done flex h-14 shrink-0 items-center justify-center gap-2.5 border-t bg-emerald-500/5 text-[15px] font-bold text-emerald-400 transition-colors hover:bg-emerald-500/15 disabled:cursor-default sm:h-auto sm:w-[104px] sm:flex-col sm:gap-2 sm:border-l sm:border-t-0 sm:text-xs",
            completing && "bg-emerald-600 text-white hover:bg-emerald-600",
          )}
        >
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border-[2.5px] border-emerald-500 transition-colors group-hover/done:bg-emerald-500 group-hover/done:text-white group-active/done:scale-90 sm:h-14 sm:w-14",
              completing &&
                "border-white bg-white text-emerald-600 group-hover/done:bg-white group-hover/done:text-emerald-600",
            )}
          >
            {completing ? (
              <CircleCheckBig className="h-5 w-5 sm:h-7 sm:w-7" aria-hidden />
            ) : (
              <Check className="h-5 w-5 sm:h-7 sm:w-7" strokeWidth={3} aria-hidden />
            )}
          </span>
          {completing ? "Concluída" : "Concluir"}
        </button>
      )}
    </article>
  );
}

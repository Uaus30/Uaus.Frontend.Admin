import { Archive, Loader2, Search, X } from "lucide-react";
import { Input, Popover, PopoverAnchor, PopoverContent } from "@workspace/ui";
import type { TaskCardSummaryDto } from "@workspace/api-client-react";
import { ColumnBadge, TaskLabelChip } from "./CardBits";

interface TaskSearchBoxProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  isActive: boolean;
  isSearching: boolean;
  results: TaskCardSummaryDto[];
  onOpen: (cardId: number) => void;
}

/**
 * A busca global do topo: digitou, a lista de resultados abre embaixo; clicou
 * num resultado, a modal do cartão abre. Acha em todos os cartões — inclusive
 * arquivados e finalizados antigos, que não estão no quadro.
 */
export function TaskSearchBox({
  value,
  onChange,
  onClear,
  isActive,
  isSearching,
  results,
  onOpen,
}: TaskSearchBoxProps) {
  return (
    <Popover open={isActive}>
      <PopoverAnchor asChild>
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && onClear()}
            placeholder="Buscar em todos os cartões (#12, título, etiqueta…)"
            aria-label="Buscar cartões"
            className="bg-background/80 pl-9 pr-9 backdrop-blur"
          />
          {value && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Limpar busca"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </PopoverAnchor>

      <PopoverContent
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={onClear}
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-1"
      >
        {isSearching && results.length === 0 ? (
          <p className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
          </p>
        ) : results.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted-foreground">Nenhum cartão encontrado.</p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto">
            {results.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  onClick={() => {
                    onOpen(card.id);
                    onClear();
                  }}
                  className="flex w-full flex-col gap-1 rounded-md px-3 py-2 text-left hover:bg-foreground/10 focus-visible:bg-foreground/10 focus-visible:outline-none"
                >
                  <span className="text-sm font-medium text-foreground">
                    <span className="mr-1.5 font-mono text-xs text-muted-foreground">#{card.number}</span>
                    {card.title}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <ColumnBadge status={card.status} />
                    {card.isArchived && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        <Archive className="h-3 w-3" /> Arquivado
                      </span>
                    )}
                    {card.labels.slice(0, 3).map((label) => (
                      <TaskLabelChip key={label.id} label={label} size="sm" />
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

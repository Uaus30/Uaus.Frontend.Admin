import { ArchiveRestore, Inbox } from "lucide-react";
import { Button, Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui";
import { useGetArchivedTaskCards } from "@workspace/api-client-react";
import { formatBrasiliaDateTime } from "@workspace/core";
import { ColumnBadge, TaskLabelChip } from "./CardBits";

interface ArchivedCardsSheetProps {
  open: boolean;
  onClose: () => void;
  onOpenCard: (cardId: number) => void;
  onUnarchive: (cardId: number) => Promise<unknown>;
  isUnarchiving: boolean;
}

/**
 * A gaveta dos arquivados: o que saiu do quadro sem ser excluído. Cada linha
 * abre o cartão ou o devolve à coluna de origem.
 */
export function ArchivedCardsSheet({
  open,
  onClose,
  onOpenCard,
  onUnarchive,
  isUnarchiving,
}: ArchivedCardsSheetProps) {
  const { data, isLoading } = useGetArchivedTaskCards({ query: { enabled: open } });
  const cards = data ?? [];

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 pb-3 pt-5 text-left">
          <SheetTitle>Cartões arquivados</SheetTitle>
          <SheetDescription>
            Fora do quadro, mas não excluídos. Desarquivar devolve ao fim da coluna em que estava.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {isLoading ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">Carregando…</p>
          ) : cards.length === 0 ? (
            <div className="px-2 py-10 text-center text-muted-foreground">
              <Inbox className="mx-auto mb-2 h-10 w-10 opacity-50" />
              <p className="text-sm">Nenhum cartão arquivado.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {cards.map((card) => (
                <li key={card.id} className="rounded-lg border bg-card p-3">
                  <button
                    type="button"
                    onClick={() => onOpenCard(card.id)}
                    className="w-full text-left text-sm font-medium hover:underline"
                  >
                    <span className="mr-1.5 font-mono text-xs text-muted-foreground">#{card.number}</span>
                    {card.title}
                  </button>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <ColumnBadge status={card.status} />
                    {card.labels.slice(0, 3).map((label) => (
                      <TaskLabelChip key={label.id} label={label} size="sm" />
                    ))}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {card.updatedAt ? `Arquivado em ${formatBrasiliaDateTime(card.updatedAt)}` : ""}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className="gap-1.5"
                      disabled={isUnarchiving}
                      onClick={() => void onUnarchive(card.id)}
                    >
                      <ArchiveRestore className="h-4 w-4" /> Desarquivar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

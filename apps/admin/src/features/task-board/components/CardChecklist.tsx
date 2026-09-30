import { useState } from "react";
import { Plus, SquareCheckBig, Trash2 } from "lucide-react";
import { Button, Checkbox, Input, cn } from "@workspace/ui";
import type { TaskCardChecklistItemDto } from "@workspace/api-client-react";

interface CardChecklistProps {
  items: TaskCardChecklistItemDto[];
  onAdd: (text: string) => Promise<unknown>;
  onToggle: (item: TaskCardChecklistItemDto) => void;
  onRename: (item: TaskCardChecklistItemDto, text: string) => void;
  onDelete: (itemId: number) => void;
  busy: boolean;
}

/**
 * O checklist do cartão: barra de progresso, itens com caixa (marcar salva na
 * hora), texto editável ao clicar, e a caixa de "novo item" que fica aberta
 * depois de adicionar — a lista costuma nascer de uma vez.
 */
export function CardChecklist({ items, onAdd, onToggle, onRename, onDelete, busy }: CardChecklistProps) {
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const done = items.filter((i) => i.isDone).length;
  const percent = items.length === 0 ? 0 : Math.round((done / items.length) * 100);

  async function submitNew() {
    const text = newText.trim();
    if (!text) return;
    await onAdd(text);
    setNewText("");
  }

  return (
    <section className="space-y-2">
      <header className="flex items-center gap-2">
        <SquareCheckBig className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Checklist</h3>
        {items.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {done}/{items.length}
          </span>
        )}
      </header>

      {items.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="w-9 text-right text-xs text-muted-foreground">{percent}%</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-[width]",
                percent === 100 ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      <ul className="space-y-1">
        {items.map((item) => (
          <ChecklistRow
            key={item.id}
            item={item}
            onToggle={onToggle}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
      </ul>

      {adding ? (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submitNew();
              }
              if (e.key === "Escape") {
                setAdding(false);
                setNewText("");
              }
            }}
            placeholder="Novo item…"
            maxLength={300}
            className="h-9 text-sm"
          />
          <Button type="button" size="sm" onClick={() => void submitNew()} disabled={busy || !newText.trim()}>
            Adicionar
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setAdding(false)}>
            Fechar
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={() => setAdding(true)}
        >
          <Plus className="h-4 w-4" /> Adicionar item
        </Button>
      )}
    </section>
  );
}

interface ChecklistRowProps {
  item: TaskCardChecklistItemDto;
  onToggle: (item: TaskCardChecklistItemDto) => void;
  onRename: (item: TaskCardChecklistItemDto, text: string) => void;
  onDelete: (itemId: number) => void;
}

function ChecklistRow({ item, onToggle, onRename, onDelete }: ChecklistRowProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(item.text);

  function commit() {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed && trimmed !== item.text) onRename(item, trimmed);
    else setText(item.text);
  }

  return (
    <li className="group/item flex items-start gap-2 rounded-md px-1 py-1 hover:bg-accent/50">
      <Checkbox
        checked={item.isDone}
        onCheckedChange={() => onToggle(item)}
        aria-label={item.isDone ? "Desmarcar" : "Marcar como feito"}
        className="mt-0.5"
      />
      {editing ? (
        <Input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setText(item.text);
              setEditing(false);
            }
          }}
          maxLength={300}
          className="h-7 flex-1 text-sm"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={cn(
            "flex-1 text-left text-sm leading-6",
            item.isDone && "text-muted-foreground line-through",
          )}
        >
          {item.text}
        </button>
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={() => onDelete(item.id)}
        aria-label="Remover item"
        className="h-7 w-7 text-muted-foreground opacity-60 hover:text-destructive group-hover/item:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </li>
  );
}

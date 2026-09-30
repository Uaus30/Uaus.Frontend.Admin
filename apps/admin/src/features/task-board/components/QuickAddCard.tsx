import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button, Textarea } from "@workspace/ui";

interface QuickAddCardProps {
  /** Nome da coluna, para o placeholder. */
  columnTitle: string;
  onAdd: (title: string) => Promise<unknown>;
  isAdding: boolean;
}

/**
 * O "+ Adicionar um cartão" do rodapé da coluna, como no Trello: vira uma caixa
 * de texto, Enter cria e mantém a caixa aberta para o próximo (registrar várias
 * demandas em sequência é o caso comum), Esc ou clicar fora fecha. O texto
 * digitado fica guardado: reabrir mostra o rascunho, em vez de perdê-lo por um
 * clique fora sem querer.
 */
export function QuickAddCard({ columnTitle, onAdd, isAdding }: QuickAddCardProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || isAdding) return;
    await onAdd(trimmed);
    setTitle("");
    textareaRef.current?.focus();
  }

  function close() {
    setOpen(false);
    setTitle("");
  }

  /** Clicou fora da caixa (o foco saiu do formulário): fecha e guarda o rascunho. */
  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        Adicionar um cartão
      </button>
    );
  }

  return (
    <div className="space-y-2" onBlur={handleBlur}>
      <Textarea
        ref={textareaRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") close();
        }}
        placeholder={`Nova tarefa em ${columnTitle}…`}
        rows={2}
        maxLength={200}
        className="resize-none bg-card/95 text-sm"
      />
      <div className="flex items-center gap-1">
        {/* onMouseDown com preventDefault: o clique no botão não pode tirar o foco
            da caixa antes do click — em navegador que não foca botão, o blur
            fecharia a caixa e o click nunca chegaria. */}
        <Button
          type="button"
          size="sm"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void submit()}
          disabled={isAdding || !title.trim()}
        >
          {isAdding ? "Adicionando…" : "Adicionar"}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onMouseDown={(e) => e.preventDefault()}
          onClick={close}
          aria-label="Cancelar"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

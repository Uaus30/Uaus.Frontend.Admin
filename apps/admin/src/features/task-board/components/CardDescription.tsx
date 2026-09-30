import { useState } from "react";
import { AlignLeft } from "lucide-react";
import { Button, Textarea } from "@workspace/ui";

interface CardDescriptionProps {
  value: string;
  onSave: (value: string) => void;
  isSaving: boolean;
}

/**
 * A descrição: texto corrido que abre para edição ao clicar. Salva no botão ou
 * com Ctrl+Enter; Esc descarta. Não salva a cada tecla porque a descrição é o
 * campo longo do cartão e cada gravação invalida o quadro inteiro.
 */
export function CardDescription({ value, onSave, isSaving }: CardDescriptionProps) {
  // O rascunho nasce do valor do servidor e NÃO o acompanha por efeito: quem
  // renderiza passa `key={value}`, então uma descrição nova vinda do servidor
  // remonta o componente com o rascunho certo — sem setState dentro de efeito.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  function commit() {
    onSave(draft);
    setEditing(false);
  }

  return (
    <section className="space-y-2">
      <header className="flex items-center gap-2">
        <AlignLeft className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Descrição</h3>
        {!editing && value && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto h-7"
            onClick={() => setEditing(true)}
          >
            Editar
          </Button>
        )}
      </header>

      {editing ? (
        <div className="space-y-2">
          <Textarea
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commit();
              if (e.key === "Escape") {
                setDraft(value);
                setEditing(false);
              }
            }}
            rows={6}
            maxLength={5000}
            placeholder="Detalhe a demanda: o que precisa ser feito, para quem, até quando…"
            className="text-sm"
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={commit} disabled={isSaving}>
              {isSaving ? "Salvando…" : "Salvar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setDraft(value);
                setEditing(false);
              }}
            >
              Cancelar
            </Button>
            <span className="ml-auto text-[11px] text-muted-foreground">Ctrl+Enter salva</span>
          </div>
        </div>
      ) : value ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full whitespace-pre-wrap rounded-md px-1 py-1 text-left text-sm leading-relaxed text-foreground hover:bg-accent/50"
        >
          {value}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full rounded-md bg-muted/60 px-3 py-3 text-left text-sm text-muted-foreground hover:bg-muted"
        >
          Adicionar uma descrição mais detalhada…
        </button>
      )}
    </section>
  );
}

import { useRef, useState } from "react";
import { AlignLeft } from "lucide-react";
import { Button, Textarea } from "@workspace/ui";

interface CardDescriptionProps {
  value: string;
  onSave: (value: string) => void;
  isSaving: boolean;
}

/** Altura mínima da caixa de edição quando não há texto para medir. */
const EMPTY_EDITOR_HEIGHT = 144;

/**
 * A descrição: texto corrido que abre para edição ao clicar. Salva no botão ou
 * com Ctrl+Enter; Esc descarta. Não salva a cada tecla porque a descrição é o
 * campo longo do cartão e cada gravação invalida o quadro inteiro.
 *
 * A caixa de edição nasce com a MESMA altura da caixa de leitura: medida no
 * clique, antes de trocar. Sem isso o texto de dez linhas virava uma caixa de
 * seis e o conteúdo "encolhia" na hora de editar.
 */
export function CardDescription({ value, onSave, isSaving }: CardDescriptionProps) {
  // O rascunho nasce do valor do servidor e NÃO o acompanha por efeito: quem
  // renderiza passa `key={value}`, então uma descrição nova vinda do servidor
  // remonta o componente com o rascunho certo — sem setState dentro de efeito.
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [editorHeight, setEditorHeight] = useState(EMPTY_EDITOR_HEIGHT);
  const viewRef = useRef<HTMLButtonElement>(null);

  function startEditing() {
    setEditorHeight(Math.max(EMPTY_EDITOR_HEIGHT, viewRef.current?.offsetHeight ?? 0));
    setEditing(true);
  }

  function stopEditing() {
    setDraft(value);
    setEditing(false);
  }

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
          <Button type="button" size="sm" variant="ghost" className="ml-auto h-7" onClick={startEditing}>
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
              if (e.key === "Escape") stopEditing();
            }}
            style={{ minHeight: editorHeight }}
            maxLength={5000}
            placeholder="Detalhe a demanda: o que precisa ser feito, para quem, até quando…"
            // Mesmo padding e entrelinha da caixa de leitura: a altura medida lá
            // só vale aqui se o texto quebrar nas mesmas linhas.
            className="rounded-md bg-foreground/[0.06] px-3 py-2.5 text-sm leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={commit} disabled={isSaving}>
              {isSaving ? "Salvando…" : "Salvar"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={stopEditing}>
              Cancelar
            </Button>
            <span className="ml-auto text-[11px] text-muted-foreground">Ctrl+Enter salva</span>
          </div>
        </div>
      ) : value ? (
        // Fundo um pouco mais claro que o do cartão: separa o texto corrido do
        // resto da modal sem virar uma "caixa" pesada.
        <button
          ref={viewRef}
          type="button"
          onClick={startEditing}
          className="w-full whitespace-pre-wrap rounded-md border border-transparent bg-foreground/[0.06] px-3 py-2.5 text-left text-sm leading-relaxed text-foreground transition-colors hover:bg-foreground/10"
        >
          {value}
        </button>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="w-full rounded-md bg-foreground/[0.06] px-3 py-3 text-left text-sm text-muted-foreground hover:bg-foreground/10"
        >
          Adicionar uma descrição mais detalhada…
        </button>
      )}
    </section>
  );
}

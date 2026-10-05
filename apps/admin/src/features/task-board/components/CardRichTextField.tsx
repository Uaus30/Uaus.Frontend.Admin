import { useState } from "react";
import { CircleCheckBig, type LucideIcon } from "lucide-react";
import { Button, cn, filledFieldClass } from "@workspace/ui";
import { RichTextEditingArea, RichTextEditor, RichTextView, isBlankRichText } from "@/components/rich-text";

interface CardRichTextFieldProps {
  title: string;
  icon: LucideIcon;
  /** O valor do servidor ("" quando não há). Quem renderiza passa `key` com ele: valor novo remonta o campo. */
  value: string;
  /** O convite do campo vazio. */
  emptyLabel: string;
  placeholder: string;
  ariaLabel: string;
  /** Grava; a edição só fecha quando a promessa resolve — se falhar, o rascunho fica. */
  onSave: (html: string) => Promise<unknown>;
  /**
   * Mostra o "Salvar e finalizar" ao lado do "Salvar". Só a solução tem, e só
   * em cartão que pode ir para Finalizado (não arquivado e ainda fora dela).
   */
  onSaveAndFinish?: (html: string) => Promise<unknown>;
  isSaving: boolean;
  /**
   * Destaque de campo preenchido (`filledFieldClass`, o verde do cadastro de
   * cliente): na solução, pedido do dono em 05/10/2026 — "contorno verde após
   * ser preenchido". Vem com o ícone verde e o rótulo "registrada", para a cor
   * não ficar sozinha.
   */
  highlightFilled?: boolean;
}

/**
 * Um campo de texto formatado do cartão — a descrição e a solução: texto que
 * abre para edição ao clicar, com a barra de formatação. Salva no botão ou com
 * Ctrl+Enter; Esc descarta. Não salva a cada tecla porque cada gravação
 * invalida o quadro inteiro.
 *
 * Só manda o que mudou: abrir e salvar sem mexer não grava nada — senão uma
 * descrição antiga em texto puro viraria HTML e o histórico diria "editou a
 * descrição" sem ninguém ter editado.
 */
export function CardRichTextField(props: CardRichTextFieldProps) {
  const {
    title,
    icon: Icon,
    value,
    emptyLabel,
    placeholder,
    ariaLabel,
    onSave,
    onSaveAndFinish,
    isSaving,
  } = props;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);

  const filled = props.highlightFilled === true && !isBlankRichText(editing ? draft : value);

  function startEditing() {
    setDraft(value);
    setDirty(false);
    setEditing(true);
  }

  // Fecha a edição só depois de o servidor aceitar. Fechar antes descartava o
  // rascunho quando a gravação falhava (rede, limite de tamanho): o campo voltava
  // ao valor do servidor e o texto digitado sumia. O aviso do erro vem do hook.
  async function finishWith(save: () => Promise<unknown>) {
    try {
      await save();
      setEditing(false);
    } catch {
      // Avisado pelo hook; o rascunho fica para tentar de novo.
    }
  }

  function save() {
    if (!dirty) {
      setEditing(false);
      return;
    }
    void finishWith(() => onSave(draft));
  }

  function saveAndFinish() {
    if (onSaveAndFinish) void finishWith(() => onSaveAndFinish(draft));
  }

  return (
    <section className="space-y-2">
      <header className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", filled ? "text-emerald-500" : "text-muted-foreground")} />
        <h3 className="text-sm font-semibold">{title}</h3>
        {filled && !editing && (
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">registrada</span>
        )}
        {!editing && value && (
          <Button type="button" size="sm" variant="ghost" className="ml-auto h-7" onClick={startEditing}>
            Editar
          </Button>
        )}
      </header>

      {editing ? (
        <RichTextEditingArea onCancel={() => setEditing(false)} className="space-y-2">
          <RichTextEditor
            initialValue={value}
            autoFocus
            onChange={(html) => {
              setDraft(html);
              setDirty(true);
            }}
            onSubmit={save}
            placeholder={placeholder}
            ariaLabel={ariaLabel}
            minHeight={120}
            className={cn(
              props.highlightFilled &&
                !isBlankRichText(draft) &&
                // O anel de foco do tema é laranja: por cima do contorno verde,
                // os dois viravam um amarelo que não diz "preenchido".
                cn(filledFieldClass(true), "focus-within:ring-emerald-500/60"),
            )}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" onClick={save} disabled={isSaving}>
              {isSaving ? "Salvando…" : "Salvar"}
            </Button>
            {onSaveAndFinish && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="gap-1.5"
                onClick={saveAndFinish}
                disabled={isSaving || isBlankRichText(draft)}
              >
                <CircleCheckBig className="h-4 w-4 text-emerald-500" /> Salvar e finalizar
              </Button>
            )}
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <span className="ml-auto text-[11px] text-muted-foreground">Ctrl+Enter salva</span>
          </div>
        </RichTextEditingArea>
      ) : value ? (
        // Clicar no texto abre a edição — menos num link, que tem que abrir o
        // endereço. O "Editar" do cabeçalho é o caminho do teclado.
        <div
          onClick={(e) => {
            if (!(e.target as HTMLElement).closest("a")) startEditing();
          }}
          className={cn(
            "cursor-text rounded-md border border-transparent px-3 py-2.5 transition-colors",
            filled ? filledFieldClass(true) : "bg-foreground/[0.06] hover:bg-foreground/10",
          )}
        >
          <RichTextView value={value} />
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className="w-full rounded-md bg-foreground/[0.06] px-3 py-3 text-left text-sm text-muted-foreground hover:bg-foreground/10"
        >
          {emptyLabel}
        </button>
      )}
    </section>
  );
}

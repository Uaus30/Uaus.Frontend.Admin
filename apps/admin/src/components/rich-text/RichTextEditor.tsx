import { useEffect, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { cn } from "@workspace/ui";
import { RICH_TEXT_CLASSES, toEditorHtml, trimTrailingEmptyParagraphs } from "./content";
import { RICH_TEXT_EXTENSIONS } from "./extensions";
import { RichTextToolbar } from "./RichTextToolbar";

/** O placeholder do Tiptap é um `::before` no primeiro parágrafo vazio; a cor e a posição são daqui. */
const PLACEHOLDER_CLASSES = [
  "[&_p.is-editor-empty:first-child]:before:pointer-events-none",
  "[&_p.is-editor-empty:first-child]:before:float-left",
  "[&_p.is-editor-empty:first-child]:before:h-0",
  "[&_p.is-editor-empty:first-child]:before:text-muted-foreground",
  "[&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
].join(" ");

/**
 * Atributo que marca a área do editor. A modal que o contém usa para não fechar
 * no Esc: dentro do editor, Esc é "cancelar a edição" — e o Radix fecha o
 * diálogo antes de o editor ver a tecla.
 */
export const RICH_TEXT_EDITOR_ATTRIBUTE = "data-rich-text-editor";

interface RichTextEditorProps {
  /**
   * Valor inicial: HTML, ou texto puro de cartão antigo. O editor NÃO acompanha
   * mudanças depois de montado — para trocar o conteúdo, remonte com `key`.
   */
  initialValue?: string | null;
  /** A cada alteração: o HTML, ou "" quando o editor está vazio. */
  onChange: (html: string) => void;
  /** Ctrl+Enter (Cmd+Enter no Mac). */
  onSubmit?: () => void;
  /** Esc (dentro do editor ou da barra dele). */
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel: string;
  /** Altura mínima da área de texto, em px. */
  minHeight?: number;
  /**
   * Altura máxima da área de texto, em px; passando dela, o texto rola por
   * dentro e a barra e os botões de quem usa o editor continuam à vista.
   */
  maxHeight?: number;
  className?: string;
}

/**
 * Editor de texto formatado (Tiptap), com a barra fixa no topo. Usado na
 * descrição, na solução e nos comentários do quadro de tarefas.
 */
export function RichTextEditor({
  initialValue,
  onChange,
  onSubmit,
  onCancel,
  placeholder,
  autoFocus,
  ariaLabel,
  minHeight = 96,
  maxHeight,
  className,
}: RichTextEditorProps) {
  // O editor nasce uma vez; os callbacks do pai mudam a cada render. Pela ref,
  // o atalho e o onUpdate sempre chamam a versão mais nova.
  const handlers = useRef({ onChange, onSubmit, onCancel });
  useEffect(() => {
    handlers.current = { onChange, onSubmit, onCancel };
  });

  const editor = useEditor({
    extensions: [...RICH_TEXT_EXTENSIONS, Placeholder.configure({ placeholder: placeholder ?? "" })],
    content: toEditorHtml(initialValue),
    autofocus: autoFocus ? "end" : false,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class: cn(RICH_TEXT_CLASSES, PLACEHOLDER_CLASSES, "px-3 py-2.5 outline-none"),
        style:
          `min-height: ${minHeight}px` + (maxHeight ? `; max-height: ${maxHeight}px; overflow-y: auto` : ""),
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel,
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
          handlers.current.onSubmit?.();
          return true;
        }
        // O Esc NÃO é tratado aqui: dentro da modal, o Radix o vê antes (captura
        // no document) e o marca com preventDefault para a modal não fechar — e o
        // ProseMirror ignora evento já marcado. Ele chega pelo onKeyDown abaixo.
        return false;
      },
    },
    onUpdate: ({ editor: e }) =>
      handlers.current.onChange(e.isEmpty ? "" : trimTrailingEmptyParagraphs(e.getHTML())),
  });

  return (
    <div
      {...{ [RICH_TEXT_EDITOR_ATTRIBUTE]: "" }}
      // O React entrega o Esc mesmo marcado pela modal. `contains`: o popover do
      // link vem num portal, e o evento sintético dele sobe pela árvore React até
      // aqui — sem a conferência, fechar o popover com Esc cancelaria a edição.
      onKeyDown={(e) => {
        if (e.key === "Escape" && onCancel && e.currentTarget.contains(e.target as Node)) onCancel();
      }}
      className={cn(
        "overflow-hidden rounded-md border bg-foreground/[0.04] focus-within:ring-2 focus-within:ring-ring",
        className,
      )}
    >
      {editor && <RichTextToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

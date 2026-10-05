import type { ReactNode } from "react";
import { useEditorState, type Editor } from "@tiptap/react";
import {
  Bold,
  Check,
  ChevronDown,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  SquareCode,
  Strikethrough,
  TextAlignCenter,
  TextAlignEnd,
  TextAlignJustify,
  TextAlignStart,
  TextQuote,
  Type,
  Underline,
  type LucideIcon,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  cn,
} from "@workspace/ui";
import { stopEscape } from "./content";
import { ColorPicker, LinkPicker } from "./RichTextPickers";

interface BlockOption {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

/**
 * Os tipos de bloco do menu "Texto". "Texto" e os títulos usam `clearNodes`
 * antes: dentro de uma lista ou citação, só trocar o nó não tira o texto de lá
 * (o item de lista exige parágrafo).
 */
const BLOCKS: BlockOption[] = [
  {
    id: "paragraph",
    label: "Texto",
    icon: Type,
    isActive: (e) =>
      e.isActive("paragraph") &&
      !e.isActive("bulletList") &&
      !e.isActive("orderedList") &&
      !e.isActive("blockquote"),
    run: (e) => e.chain().focus().clearNodes().run(),
  },
  ...([1, 2, 3] as const).map<BlockOption>((level) => ({
    id: `h${level}`,
    label: `Título ${level}`,
    icon: [Heading1, Heading2, Heading3][level - 1],
    isActive: (e) => e.isActive("heading", { level }),
    run: (e) =>
      e.isActive("heading", { level })
        ? e.chain().focus().setParagraph().run()
        : e.chain().focus().clearNodes().setHeading({ level }).run(),
  })),
  {
    id: "bulletList",
    label: "Lista com marcadores",
    icon: List,
    isActive: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    id: "orderedList",
    label: "Lista numerada",
    icon: ListOrdered,
    isActive: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "blockquote",
    label: "Citação",
    icon: TextQuote,
    isActive: (e) => e.isActive("blockquote"),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "codeBlock",
    label: "Bloco de código",
    icon: SquareCode,
    isActive: (e) => e.isActive("codeBlock"),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
];

const ALIGNMENTS = [
  { value: "left", label: "Alinhar à esquerda", icon: TextAlignStart },
  { value: "center", label: "Centralizar", icon: TextAlignCenter },
  { value: "right", label: "Alinhar à direita", icon: TextAlignEnd },
  { value: "justify", label: "Justificar", icon: TextAlignJustify },
] as const;

/**
 * A barra do editor, fixa acima do texto (e não flutuando sobre a seleção como
 * no ClickUp): no celular a seleção é difícil, e a barra fixa está sempre à mão.
 *
 * Os botões não roubam o foco (`onMouseDown` com `preventDefault`): clicar em
 * "Negrito" com uma palavra selecionada tem que agir sobre ela.
 */
export function RichTextToolbar({ editor }: { editor: Editor }) {
  // O editor não re-renderiza a cada tecla (`shouldRerenderOnTransaction: false`);
  // a barra assina só o que pinta.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: (BLOCKS.slice(1).find((b) => b.isActive(e)) ?? BLOCKS[0]).id,
      align: ALIGNMENTS.find((a) => e.isActive({ textAlign: a.value }))?.value ?? "left",
      color: (e.getAttributes("textStyle").color as string | undefined) ?? null,
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
    }),
  });

  const block = BLOCKS.find((b) => b.id === state.block) ?? BLOCKS[0];
  const align = ALIGNMENTS.find((a) => a.value === state.align) ?? ALIGNMENTS[0];
  const AlignIcon = align.icon;

  return (
    <div
      role="toolbar"
      aria-label="Formatação do texto"
      className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1"
    >
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            aria-label="Tipo de texto"
          >
            {block.label === "Texto" ? "Texto" : <block.icon className="h-4 w-4" />}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={stopEscape}
        >
          {BLOCKS.map((option) => (
            <DropdownMenuItem key={option.id} onSelect={() => option.run(editor)} className="gap-2">
              <option.icon className="h-4 w-4" />
              {option.label}
              {option.id === block.id && <Check className="ml-auto h-3.5 w-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator />

      <ColorPicker editor={editor} current={state.color} />

      <MarkButton
        label="Negrito (Ctrl+B)"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </MarkButton>
      <MarkButton
        label="Itálico (Ctrl+I)"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </MarkButton>
      <MarkButton
        label="Sublinhado (Ctrl+U)"
        active={state.underline}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="h-4 w-4" />
      </MarkButton>
      <MarkButton
        label="Tachado"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </MarkButton>
      <MarkButton
        label="Código"
        active={state.code}
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code className="h-4 w-4" />
      </MarkButton>

      <Separator />

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-0.5 px-1.5"
            aria-label="Alinhamento"
          >
            <AlignIcon className="h-4 w-4" />
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          onCloseAutoFocus={(e) => e.preventDefault()}
          onEscapeKeyDown={stopEscape}
        >
          {ALIGNMENTS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onSelect={() => editor.chain().focus().setTextAlign(option.value).run()}
              className="gap-2"
            >
              <option.icon className="h-4 w-4" />
              {option.label}
              {option.value === align.value && <Check className="ml-auto h-3.5 w-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <LinkPicker editor={editor} active={state.link} />
    </div>
  );
}

function Separator() {
  return <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />;
}

interface MarkButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

function MarkButton({ label, active, onClick, children }: MarkButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn("h-7 w-7 p-0", active && "bg-foreground/15 text-foreground")}
    >
      {children}
    </Button>
  );
}

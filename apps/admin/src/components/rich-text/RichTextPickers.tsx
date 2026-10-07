import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/react";
import { Baseline, Link } from "lucide-react";
import { Button, Input, Popover, PopoverContent, PopoverTrigger, cn } from "@workspace/ui";
import { normalizeLinkHref, stopEscape } from "./content";
import { RICH_TEXT_COLORS } from "./extensions";

/** O "A" da barra: a paleta de cores do texto, com "Padrão" para tirar a cor. */
export function ColorPicker({ editor, current }: { editor: Editor; current: string | null }) {
  const [open, setOpen] = useState(false);

  /**
   * Esc no editor com a paleta aberta é da paleta: fecha só ela.
   *
   * A paleta é o único seletor da barra que deixa o foco no editor (para a cor
   * agir sobre a seleção), então o Esc nasce no texto — dentro da área de
   * edição, que o leria como "cancelar" e levaria o rascunho. O `stopEscape` do
   * Radix segura a tecla, mas só quando o Radix considera a paleta a camada mais
   * alta; com outra camada aberta por cima, ou antes de a dele terminar de se
   * registrar, a tecla passava. O teste do quadro de Tarefas falhava assim, às
   * vezes, na suíte cheia (07/10/2026).
   *
   * Por isso a escuta também fica no próprio editor, enquanto a paleta está
   * aberta: no alvo, antes de a tecla subir até a área (o React escuta na raiz).
   * Quando o Radix já tratou, a tecla nem chega aqui.
   */
  useEffect(() => {
    if (!open || editor.isDestroyed) return;
    const dom = editor.view.dom;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
    };
    dom.addEventListener("keydown", closeOnEscape);
    return () => dom.removeEventListener("keydown", closeOnEscape);
  }, [open, editor]);

  function apply(color: string | null) {
    const chain = editor.chain().focus();
    (color ? chain.setColor(color) : chain.unsetColor()).run();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Cor do texto"
          aria-label="Cor do texto"
          onMouseDown={(e) => e.preventDefault()}
          className="h-7 w-7 p-0"
        >
          <Baseline className="h-4 w-4" style={current ? { color: current } : undefined} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onEscapeKeyDown={stopEscape}
      >
        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Cor do texto</p>
        <div className="grid grid-cols-5 gap-1.5">
          <button
            type="button"
            title="Padrão"
            aria-label="Cor padrão"
            onClick={() => apply(null)}
            className="flex h-7 w-7 items-center justify-center rounded-md border text-xs font-semibold hover:bg-foreground/10"
          >
            A
          </button>
          {RICH_TEXT_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              title={color.label}
              aria-label={color.label}
              onClick={() => apply(color.value)}
              className="flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold hover:bg-foreground/10"
              style={{ color: color.value }}
            >
              A
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * O link da barra. Com texto selecionado, vira link; sem seleção, o endereço
 * entra como texto já linkado (o jeito do ClickUp). Endereço vazio tira o link.
 */
export function LinkPicker({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");

  function openWith(next: boolean) {
    // O endereço atual ao abrir: editar o link existente em vez de redigitar.
    if (next) setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
    setOpen(next);
  }

  function apply() {
    const href = normalizeLinkHref(url);
    if (!href) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else if (editor.state.selection.empty && !active) {
      editor
        .chain()
        .focus()
        .insertContent({ type: "text", text: href, marks: [{ type: "link", attrs: { href } }] })
        .run();
    } else {
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={openWith}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          title="Link"
          aria-label="Link"
          aria-pressed={active}
          onMouseDown={(e) => e.preventDefault()}
          className={cn("h-7 w-7 p-0", active && "bg-foreground/15 text-foreground")}
        >
          <Link className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2 p-2" onEscapeKeyDown={stopEscape}>
        <Input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          placeholder="https://…"
          aria-label="Endereço do link"
          className="h-8 text-sm"
        />
        <div className="flex justify-end gap-2">
          {active && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => {
                setUrl("");
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setOpen(false);
              }}
            >
              Remover link
            </Button>
          )}
          <Button type="button" size="sm" className="h-7" onClick={apply}>
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

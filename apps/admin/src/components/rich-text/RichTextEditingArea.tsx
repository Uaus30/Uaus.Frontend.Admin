import type { ReactNode } from "react";

/**
 * Marca uma edição de texto formatado em andamento. A modal que a contém procura
 * por ela para não fechar no Esc enquanto houver uma aberta: fechar levaria o
 * rascunho junto, sem aviso.
 */
export const RICH_TEXT_EDITING_ATTRIBUTE = "data-rich-text-editing";

interface RichTextEditingAreaProps {
  /** Esc com o foco em qualquer ponto da área — o editor, a barra ou os botões. */
  onCancel: () => void;
  className?: string;
  children: ReactNode;
}

/**
 * A edição em andamento: o editor e os botões dela (Salvar, Cancelar…). O Esc é
 * tratado aqui, e não no editor, para valer também com o foco num botão — antes,
 * Esc no "Salvar" fechava a modal e o rascunho ia embora.
 *
 * Pelo `onKeyDown` do React, que entrega a tecla mesmo depois de a modal marcá-la
 * com `preventDefault` (o ProseMirror ignora evento marcado). O `contains` deixa de
 * fora o que vem de portal — o popover do link, os menus da barra —, cujo evento
 * sintético sobe pela árvore React até aqui: Esc ali só fecha o popover.
 */
export function RichTextEditingArea({ onCancel, className, children }: RichTextEditingAreaProps) {
  return (
    <div
      {...{ [RICH_TEXT_EDITING_ATTRIBUTE]: "" }}
      className={className}
      onKeyDown={(e) => {
        if (e.key === "Escape" && e.currentTarget.contains(e.target as Node)) onCancel();
      }}
    >
      {children}
    </div>
  );
}

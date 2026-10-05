import { useMemo } from "react";
import { cn } from "@workspace/ui";
import { RICH_TEXT_CLASSES, sanitizeRichText } from "./content";

interface RichTextViewProps {
  /** HTML do editor, ou texto puro de cartão antigo. */
  value: string | null | undefined;
  className?: string;
}

/**
 * O texto formatado para leitura. Passa SEMPRE por `sanitizeRichText` antes do
 * `dangerouslySetInnerHTML`: o servidor guarda o que recebe, e o que não é do
 * esquema do editor (script, evento, link `javascript:`) não chega ao DOM.
 */
export function RichTextView({ value, className }: RichTextViewProps) {
  const html = useMemo(() => sanitizeRichText(value), [value]);

  return <div className={cn(RICH_TEXT_CLASSES, className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

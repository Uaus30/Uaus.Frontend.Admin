import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui";

type HintProps = {
  /** O texto da dica. Vazio ou nulo devolve o elemento sem tooltip nenhum. */
  label: ReactNode;
  /** Lado em que a dica abre. Padrão do Radix é acima do elemento. */
  side?: "top" | "right" | "bottom" | "left";
  /** O elemento que recebe a dica. Um só, e que aceite `ref` (asChild do Radix). */
  children: ReactElement;
};

/**
 * A dica de um botão ou ícone do PDV — o substituto do atributo `title`.
 *
 * ## Por que não o `title` nativo
 *
 * O atraso dele é do SISTEMA OPERACIONAL (cerca de um segundo no Windows) e não
 * há como configurá-lo por CSS ou JavaScript. No balcão isso é tempo demais: o
 * operador passa o mouse, não vê nada, e já tirou. O tooltip do Radix abre em
 * 100ms — o atraso está no `TooltipProvider`, em `App.tsx`, num lugar só para
 * todas as dicas da tela.
 *
 * De quebra, a dica passa a respeitar o tema e a escala de fonte do PDV, coisa
 * que a caixinha do sistema nunca fez.
 *
 * ## O que ela NÃO cobre
 *
 * Botão desabilitado não dispara evento de ponteiro, então não abre tooltip —
 * diferente do `title`, que o navegador mostrava mesmo assim. Onde a dica existe
 * só para explicar o motivo do desabilitado, prefira dizer isso na própria tela.
 */
export function Hint({ label, side, children }: HintProps) {
  if (!label) return children;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}

import { Delete } from "lucide-react";

/**
 * O teclado da calculadora do PDV: as teclas, o estilo de cada tipo e o mapa do
 * teclado físico.
 *
 * Mora fora do `calculator.tsx` porque é DADO, não comportamento: são três
 * tabelas que só mudam quando alguém acrescenta uma tecla, e mantê-las no
 * componente empurrava o arquivo para além do teto de 300 linhas do CLAUDE.md
 * sem que a lógica da calculadora tivesse crescido.
 */

/** Uma tecla do teclado da calculadora. */
export type Key = {
  label: string;
  /** Texto enviado para a expressão; ausente em teclas de ação. */
  input?: string;
  action?: "clear" | "backspace" | "percent" | "equals";
  variant: "digit" | "operator" | "action" | "clear" | "equals";
  /** Ícone no lugar do rótulo, para a tecla de apagar. */
  icon?: typeof Delete;
};

export const KEYS: Key[] = [
  { label: "AC", action: "clear", variant: "clear" },
  { label: "Apagar", action: "backspace", variant: "action", icon: Delete },
  { label: "%", action: "percent", variant: "action" },
  { label: "÷", input: "÷", variant: "operator" },

  { label: "7", input: "7", variant: "digit" },
  { label: "8", input: "8", variant: "digit" },
  { label: "9", input: "9", variant: "digit" },
  { label: "×", input: "×", variant: "operator" },

  { label: "4", input: "4", variant: "digit" },
  { label: "5", input: "5", variant: "digit" },
  { label: "6", input: "6", variant: "digit" },
  { label: "−", input: "−", variant: "operator" },

  { label: "1", input: "1", variant: "digit" },
  { label: "2", input: "2", variant: "digit" },
  { label: "3", input: "3", variant: "digit" },
  { label: "+", input: "+", variant: "operator" },

  { label: "0", input: "0", variant: "digit" },
  { label: ",", input: ",", variant: "digit" },
  { label: "=", action: "equals", variant: "equals" },
];

export const KEY_STYLES: Record<Key["variant"], string> = {
  digit: "bg-foreground/10 text-foreground hover:bg-foreground/20",
  operator: "bg-primary/80 text-primary-foreground hover:bg-primary",
  action: "bg-foreground/5 text-muted-foreground hover:bg-foreground/15 hover:text-foreground",
  // Cores fixas, e não do tema: o AC precisa se destacar das outras teclas de
  // ação nos dois temas, e o painel é translúcido nos dois.
  clear: "bg-zinc-200 text-zinc-900 hover:bg-white",
  equals: "col-span-2 bg-emerald-500/90 text-white hover:bg-emerald-500",
};

/** Teclas do teclado físico que a calculadora entende, mapeadas para a expressão. */
export const KEYBOARD_INPUT: Record<string, string> = {
  "*": "×",
  x: "×",
  "/": "÷",
  "-": "−",
  "+": "+",
  ".": ",",
  ",": ",",
};

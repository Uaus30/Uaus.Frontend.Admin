import type { LucideIcon } from "lucide-react";

/** Um botão da grade da tela inicial. */
export interface HomeShortcut {
  /**
   * Rótulo do botão. É o nome curto que o dono usa ("Lucros", "Estoque"), que
   * nem sempre é o do menu ("O que trouxe lucro", "Estoque baixo"): no celular,
   * com duas colunas, o rótulo do menu quebraria em três linhas.
   */
  label: string;
  /** Uma linha dizendo o que a tela resolve — é ela que desfaz a dúvida do rótulo curto. */
  description: string;
  /** Caminho de uma rota VISÍVEL do `routes.ts` (o teste da grade confere). */
  href: string;
  icon: LucideIcon;
}

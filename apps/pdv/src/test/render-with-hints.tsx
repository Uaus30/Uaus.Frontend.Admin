import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { TooltipProvider } from "@workspace/ui";

/**
 * `render` do Testing Library com o `TooltipProvider` em volta.
 *
 * Todo componente que usa `Hint` precisa dele acima na árvore — o Radix estoura
 * "`Tooltip` must be used within `TooltipProvider`" sem ele. Na aplicação o
 * provider é único e mora no `App.tsx`, com o atraso de 100ms; num teste que
 * monta o componente sozinho ele não existe, e cada arquivo de teste recriar o
 * seu era repetir a mesma armadilha.
 */
export function renderWithHints(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

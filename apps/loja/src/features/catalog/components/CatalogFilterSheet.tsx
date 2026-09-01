import { useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@workspace/ui";
import type { CatalogFilters as Filters } from "@/routes";
import type { CatalogDepartment } from "../types";
import { CatalogFilters } from "./CatalogFilters";

interface CatalogFilterSheetProps {
  departments: CatalogDepartment[];
  isLoading: boolean;
  totalCount: number;
  filters: Filters;
}

/**
 * A mesma lista de filtros, em gaveta, para telas estreitas.
 *
 * Gaveta e não acordeão no topo: no celular a vitrine é a tela inteira, e um
 * bloco de filtros empurrando a grade para baixo faria o visitante rolar antes
 * de ver o primeiro produto. O `Sheet` do `@workspace/ui` (Radix) traz Esc,
 * clique fora, trava de scroll e devolução de foco prontos — os quatro que
 * ninguém lembra de implementar à mão.
 *
 * O estado aberto/fechado é local de propósito: é interação de componente, não
 * dado da vitrine, e não sobrevive nem precisa sobreviver a recarregar a página.
 */
export function CatalogFilterSheet({ departments, isLoading, totalCount, filters }: CatalogFilterSheetProps) {
  const [isOpen, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activeCount =
    (filters.departmentId === undefined ? 0 : 1) + (filters.categoryId === undefined ? 0 : 1);

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className="inline-flex items-center gap-2 rounded-2xl border border-border bg-white px-4 py-3 font-semibold text-foreground transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filtrar
          {activeCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-[85vw] overflow-y-auto sm:max-w-sm"
        onCloseAutoFocus={(event) => {
          // Devolver o foco ao gatilho é o certo — sem isso o teclado recomeça
          // do topo do documento. O que não pode é o navegador ROLAR até ele:
          // o botão "Filtrar" mora no alto da vitrine, e fechar a gaveta
          // jogava quem estava no meio da lista de volta para lá. Era ESTE o
          // pulo para o topo no celular, não a troca de filtro — acontecia até
          // fechando a gaveta no Esc, sem filtrar nada. `preventScroll` guarda
          // as duas coisas: o foco volta e a página fica onde está.
          event.preventDefault();
          triggerRef.current?.focus({ preventScroll: true });
        }}
      >
        <SheetHeader>
          <SheetTitle>Filtrar produtos</SheetTitle>
          <SheetDescription>Escolha um departamento e, dentro dele, uma categoria.</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <CatalogFilters
            departments={departments}
            isLoading={isLoading}
            totalCount={totalCount}
            filters={filters}
            onSelect={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

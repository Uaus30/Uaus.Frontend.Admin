import * as React from "react";
import { Button, Card } from "@workspace/ui";
import type { ProductAnomalyRowDto } from "@workspace/api-client-react";
import { AnomalyRow } from "./AnomalyRow";

/** Quantas linhas aparecem antes do "mostrar mais": cada linha tem foto, e 120 fotos de uma vez pesam. */
const PAGINA = 30;

type AnomalyListProps = {
  items: ProductAnomalyRowDto[];
  isFiltered: boolean;
  /** Muda com o filtro e a busca, para a paginação recomeçar. */
  filterKey: string;
};

/**
 * A lista dos cadastros com anomalia, da mais grave para a menos grave — a ordem
 * vem do servidor, e filtrar não a muda.
 */
export function AnomalyList({ items, isFiltered, filterKey }: AnomalyListProps) {
  const [limite, setLimite] = React.useState(PAGINA);

  // A paginação recomeça quando o recorte muda. Ajustada durante o RENDER, e
  // não num efeito: o efeito só correria depois de pintar a lista no limite
  // anterior (mesmo padrão do ranking de "O que trouxe lucro").
  const [chaveAnterior, setChaveAnterior] = React.useState(filterKey);
  if (filterKey !== chaveAnterior) {
    setChaveAnterior(filterKey);
    setLimite(PAGINA);
  }

  if (items.length === 0) {
    return (
      <Card className="border-border/60 p-8 text-center text-[13px] text-muted-foreground">
        {isFiltered ? "Nenhum cadastro corresponde ao filtro." : "Nenhum cadastro com anomalia."}
      </Card>
    );
  }

  const visiveis = items.slice(0, limite);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {visiveis.map((row) => (
          <AnomalyRow key={row.productGroupId} row={row} />
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11.5px] text-muted-foreground">
          {items.length} {items.length === 1 ? "cadastro" : "cadastros"}
          {isFiltered ? " no filtro" : " para corrigir"}
        </p>
        {limite < items.length && (
          <Button variant="outline" size="sm" onClick={() => setLimite((atual) => atual + PAGINA)}>
            Mostrar mais {Math.min(PAGINA, items.length - limite)}
          </Button>
        )}
      </div>
    </div>
  );
}

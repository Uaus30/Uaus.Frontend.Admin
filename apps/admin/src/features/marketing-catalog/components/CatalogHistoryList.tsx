import { formatCurrency, formatDate } from "@workspace/core";
import type { CatalogPieceDto } from "@workspace/api-client-react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { roleLabel } from "../lib/catalogProducts";
import { formatLabel } from "../lib/formats";
import { describeMeasure, describeUnits, unitsDelta, type DeltaTone } from "../lib/history";
import { describeProductCount, themeLabel } from "../lib/themes";

interface CatalogHistoryListProps {
  pieces: CatalogPieceDto[];
  /** Quantos dias cada lado da comparação cobre quando ela se completa. */
  measureDays: number;
}

/**
 * Verde é "vendeu mais"; âmbar é "vendeu menos"; cinza é "igual". Âmbar, e não
 * vermelho: a queda não é erro de ninguém, e a comparação não prova causa.
 */
const TONE: Record<DeltaTone, string> = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-amber-600 dark:text-amber-400",
  flat: "text-muted-foreground",
};

function Delta({ before, after }: { before: number; after: number }) {
  const delta = unitsDelta(before, after);
  return <span className={`font-semibold tabular-nums ${TONE[delta.tone]}`}>{delta.label}</span>;
}

/**
 * As peças que saíram, da mais recente para a mais antiga. Cada uma abre para
 * mostrar os produtos, com o preço impresso e a venda de cada um.
 */
export function CatalogHistoryList({ pieces, measureDays }: CatalogHistoryListProps) {
  return (
    <ul className="space-y-3">
      {pieces.map((piece) => (
        <li key={piece.id} className="rounded-xl border bg-card shadow-sm">
          <details className="group">
            <summary className="flex cursor-pointer list-none flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between [&::-webkit-details-marker]:hidden">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{piece.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {[
                    formatDate(piece.sharedAt),
                    formatLabel(piece.format),
                    themeLabel(piece.theme, piece.departmentName),
                    describeProductCount(piece.items.length),
                    piece.sharedBy,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{describeMeasure(piece, measureDays)}</p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="flex items-center gap-2 text-sm tabular-nums">
                  <span
                    className="text-muted-foreground"
                    title="Unidades vendidas no mesmo trecho da semana anterior"
                  >
                    {describeUnits(piece.unitsBefore)}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-label="depois" />
                  <span
                    className="font-medium text-foreground"
                    title="Unidades vendidas desde que a peça saiu"
                  >
                    {describeUnits(piece.unitsAfter)}
                  </span>
                  <Delta before={piece.unitsBefore} after={piece.unitsAfter} />
                </div>
                <ChevronDown
                  className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180"
                  aria-hidden
                />
              </div>
            </summary>

            <div className="overflow-x-auto border-t px-4 pb-3">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Produto</th>
                    <th className="py-2 pr-3 font-medium">Papel</th>
                    <th className="py-2 pr-3 text-right font-medium">Preço na peça</th>
                    <th className="py-2 pr-3 text-right font-medium">Antes</th>
                    <th className="py-2 pr-3 text-right font-medium">Depois</th>
                    <th className="py-2 text-right font-medium">Diferença</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {piece.items.map((item) => (
                    <tr key={item.productGroupId}>
                      <td className="max-w-[260px] truncate py-1.5 pr-3" title={item.name}>
                        {item.name}
                      </td>
                      <td className="py-1.5 pr-3 text-muted-foreground">{roleLabel(item.role)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{formatCurrency(item.price)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{item.unitsBefore}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{item.unitsAfter}</td>
                      <td className="py-1.5 text-right">
                        <Delta before={item.unitsBefore} after={item.unitsAfter} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}

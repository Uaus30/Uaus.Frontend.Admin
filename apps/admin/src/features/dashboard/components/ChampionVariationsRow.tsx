import { formatCurrency } from "@workspace/core";
import type { DashboardChampionVariation } from "../types";

/**
 * O "abrir por variação" da linha de grupo do ranking de campeões (15/10/2026).
 *
 * O produto com variações julgado pelo total entra no ranking com a venda
 * somada; esta linha mostra quanto cada variação vendeu e o saldo de cada uma —
 * é o que decide QUAIS cores repor, quando a compra é do produto.
 */
export function ChampionVariationsRow({ variations }: { variations: DashboardChampionVariation[] }) {
  return (
    <tr className="border-b border-border/40 bg-muted/20">
      <td />
      <td colSpan={6} className="px-2 pb-3 pt-1">
        <ul className="space-y-1 text-xs">
          {variations.map((variation) => (
            <li key={variation.id} className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="break-words text-foreground">{variation.name}</span>
              <span className="tabular-nums text-muted-foreground">
                {variation.quantitySold} {variation.quantitySold === 1 ? "vendido" : "vendidos"} ·{" "}
                {formatCurrency(variation.profit)} de lucro · {variation.stock} em estoque
              </span>
            </li>
          ))}
        </ul>
      </td>
    </tr>
  );
}

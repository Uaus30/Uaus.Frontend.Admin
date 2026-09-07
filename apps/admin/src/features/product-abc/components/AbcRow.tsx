import { Link } from "wouter";
import { TableCell, TableRow, cn } from "@workspace/ui";
import { formatCurrency, marginBand } from "@workspace/core";
import type { ProductAbcItemDto } from "@workspace/api-client-react";
import { BI_TONE_PILL } from "@/lib/bi-tone";
import { formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";
import { CLASS_COLORS, FREQUENCY_HINTS, FREQUENCY_LABELS, matrixCellReading } from "../lib/abc";

/** Cor da margem — a mesma faixa da entrada de estoque e do recebimento de compra. */
const MARGEM_TOM = {
  healthy: "text-emerald-600 dark:text-emerald-400",
  tight: "text-amber-600 dark:text-amber-400",
  low: "text-destructive",
} as const;

/** Acima disto o item aparece em cestas maiores que a média da loja. */
const CESTA_ALTA = 1.2;

/**
 * Uma linha da curva.
 *
 * A coluna <b>Leitura</b> é o que faz a tabela responder "isto é bom ou ruim?".
 * A classe sozinha não responde: A/B/C é escala ordinal — diz "mais" e "menos",
 * nunca "melhor" e "pior" —, e um produto classe A pode ser exatamente o que
 * está ocupando prateleira sem pagar por ela. O juízo sai do cruzamento das duas
 * classificações, que antes só existia na matriz, longe da lista.
 */
export function AbcRow({ produto }: { produto: ProductAbcItemDto }) {
  const leitura = matrixCellReading(produto.revenueClass, produto.profitClass);
  const faixaDaMargem = marginBand(produto.margin);

  return (
    <TableRow className="border-border/40">
      <TableCell className="px-2 py-2 text-right font-mono text-[11.5px] text-muted-foreground">
        {produto.rank}
      </TableCell>

      <TableCell className="max-w-[260px] px-2 py-2">
        {produto.productGroupId ? (
          <Link
            href={`/produtos/${produto.productGroupId}/detalhes`}
            className="block truncate text-[12.5px] font-medium hover:text-primary hover:underline"
          >
            {produto.productName}
          </Link>
        ) : (
          <span className="block truncate text-[12.5px] font-medium">{produto.productName}</span>
        )}
        <span className="block truncate text-[10.5px] text-muted-foreground">
          {[produto.categoryName, produto.supplierName].filter(Boolean).join(" · ") || produto.barcode}
        </span>
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        <span
          className="inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold text-background"
          style={{ backgroundColor: CLASS_COLORS[produto.class] }}
          title={`Classe ${produto.class} pelo critério escolhido. Fatura ${produto.revenueClass}, lucro ${produto.profitClass}.`}
        >
          {produto.class}
        </span>
      </TableCell>

      <TableCell className="px-2 py-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10.5px] font-semibold",
            BI_TONE_PILL[leitura.tom],
          )}
          title={leitura.dica}
        >
          <leitura.icone className="h-3 w-3 shrink-0" />
          {leitura.texto}
        </span>
      </TableCell>

      {/* A barra é a curva vista de dentro da tabela: descendo a lista dá para
          ver onde a classe A termina. */}
      <TableCell className="px-2 py-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted sm:w-24">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${produto.cumulativeShare}%`,
                backgroundColor: CLASS_COLORS[produto.class],
              }}
            />
          </span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {formatPercent(produto.cumulativeShare, 0)}
          </span>
        </div>
      </TableCell>

      <TableCell className="px-2 py-2 text-right font-mono text-[12px] tabular-nums">
        {formatInteger(produto.units)}
      </TableCell>
      <TableCell className="px-2 py-2 text-right font-mono text-[12px] tabular-nums">
        {formatCurrency(produto.revenue)}
      </TableCell>
      <TableCell
        className={cn(
          "px-2 py-2 text-right font-mono text-[12px] tabular-nums",
          produto.profit < 0 && "font-semibold text-destructive",
        )}
      >
        {formatCurrency(produto.profit)}
      </TableCell>

      {/* A margem usa a MESMA faixa de cor da entrada de estoque (verde a partir
          de 40%, âmbar até 30%, vermelho abaixo). Antes ela só ficava verde
          quando o produto era classe A de lucro, o que misturava duas
          informações diferentes na mesma cor. */}
      <TableCell
        className={cn(
          "px-2 py-2 text-right font-mono text-[12px] tabular-nums",
          faixaDaMargem ? MARGEM_TOM[faixaDaMargem] : "text-muted-foreground",
        )}
        title="Verde a partir de 40%, âmbar de 30% a 40%, vermelho abaixo de 30% — a faixa de margem da loja"
      >
        {formatPercent(produto.margin)}
      </TableCell>

      <TableCell className="px-2 py-2 text-center">
        <span
          className="text-[11px] text-muted-foreground"
          title={`${FREQUENCY_HINTS[produto.frequency]} — ${produto.weeksWithSales} semana(s)`}
        >
          {FREQUENCY_LABELS[produto.frequency]}
        </span>
      </TableCell>

      {/* Acima de 1, o item aparece em cestas maiores que a média — o argumento
          contra cortar a cauda por ela ser cauda. */}
      <TableCell
        className={cn(
          "px-2 py-2 text-right font-mono text-[12px] tabular-nums",
          produto.basketLift >= CESTA_ALTA
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-muted-foreground",
        )}
        title={
          produto.basketLift >= CESTA_ALTA
            ? `As compras que levam este produto são ${formatPercent((produto.basketLift - 1) * 100, 0)} maiores que a média da loja — cortá-lo leva a cesta junto`
            : "Ticket médio das vendas com este produto, dividido pelo ticket médio da loja"
        }
      >
        {produto.basketLift > 0 ? `${produto.basketLift.toFixed(2)}×` : "—"}
      </TableCell>

      <TableCell className="px-2 py-2 text-right font-mono text-[12px] tabular-nums text-muted-foreground">
        {formatInteger(produto.stock)}
      </TableCell>
    </TableRow>
  );
}

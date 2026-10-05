import React from "react";
import { Link } from "wouter";
import { ArrowDown, ArrowUp, Loader2, Trophy, Truck } from "lucide-react";
import { Button, Skeleton, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { useChampions } from "../hooks/useChampions";
import type { DashboardChampion } from "../types";
import { rankChange, stockLabel } from "../breakdowns";
import { ChartCard, ChartEmptyState } from "./chart-primitives";

type ChampionsTableProps = ReturnType<typeof useChampions>;

function percent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

/** Posição com a mudança contra a janela anterior. */
function RankCell({ champion }: { champion: DashboardChampion }) {
  const change = rankChange(champion);
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
          champion.rank <= 3 ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground",
        )}
      >
        {champion.rank}
      </span>
      {change?.kind === "new" && (
        <span
          className="text-[10px] font-medium uppercase tracking-wide text-sky-400"
          title="Não estava no ranking da janela anterior"
        >
          novo
        </span>
      )}
      {change && change.kind !== "new" && (
        <span
          className={cn(
            "inline-flex items-center text-[10px] font-medium tabular-nums",
            change.kind === "up" ? "text-emerald-400" : "text-destructive",
          )}
          title={`Era o ${champion.previousRank}º nos 30 dias anteriores`}
        >
          {change.kind === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {change.positions}
        </span>
      )}
    </div>
  );
}

/**
 * Estoque como alerta ativo: só o que é problema ganha cor. Pintar de verde a
 * coluna inteira gastaria a atenção no que está bem — medido em 04/10/2026, dois
 * dos dez campeões precisavam de reposição, e eram eles que tinham que saltar.
 */
function StockCell({ champion }: { champion: DashboardChampion }) {
  const label = stockLabel(champion);
  const tone =
    champion.stockAlert === "out" || champion.stockAlert === "critical"
      ? "bg-destructive/15 text-destructive font-medium"
      : champion.stockAlert === "low"
        ? "bg-amber-500/15 text-amber-300 font-medium"
        : "text-muted-foreground";

  return (
    <div className="flex flex-col items-end gap-1">
      <span
        className={cn("inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs tabular-nums", tone)}
      >
        {label}
      </span>
      {champion.hasOpenPurchase && (
        <span
          className="inline-flex items-center gap-1 text-[10px] text-sky-400"
          title="Há compra em aberto deste produto"
        >
          <Truck className="h-3 w-3" /> a caminho
        </span>
      )}
    </div>
  );
}

/**
 * ChampionsTable
 *
 * Os produtos que mais deram LUCRO nos últimos 30 dias, com o estoque de cada um
 * lido como alerta (esgotado, acabando, a caminho) e "Ver mais" para ir além do
 * top 10.
 *
 * Por lucro e não por faturamento, a pedido do dono: é o que mostra quem sustenta
 * a loja. Medido em 04/10/2026, o ranking quase repete o de faturamento, mas sobem
 * os de margem alta (pendrive 55%, taça 58%).
 */
export function ChampionsTable({
  champions,
  canShowMore,
  canShowLess,
  showMore,
  showLess,
  isLoading,
  isFetching,
  isError,
}: ChampionsTableProps) {
  if (isLoading) {
    return <Skeleton className="h-[480px] rounded-xl" />;
  }

  const products = champions?.products ?? [];
  const topShare = products.slice(0, 10).reduce((sum, product) => sum + product.profitShare, 0);
  const description = champions
    ? `Os que mais deram lucro nos últimos ${champions.days} dias · o top ${Math.min(10, products.length)} responde por ${percent(topShare)} do lucro de ${formatCurrency(champions.totalProfit)}`
    : "Os que mais deram lucro nos últimos 30 dias";

  return (
    <ChartCard
      title="Produtos campeões"
      description={description}
      action={<Trophy className="h-5 w-5 text-primary" aria-hidden />}
    >
      {isError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Não foi possível carregar os produtos campeões.
        </p>
      )}

      {/* Sem resposta (primeira carga falhou), o aviso de erro acima basta: dizer
          também "nenhum produto vendido" contradiria o aviso. */}
      {!champions ? null : products.length === 0 ? (
        <ChartEmptyState message="Nenhum produto vendido nos últimos 30 dias." />
      ) : (
        <div className={cn("-mx-1 overflow-x-auto transition-opacity", isFetching && "opacity-70")}>
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60 text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="w-16 px-2 pb-2 font-medium">#</th>
                <th className="px-2 pb-2 font-medium">Produto</th>
                <th className="px-2 pb-2 text-right font-medium">Lucro</th>
                <th className="px-2 pb-2 text-right font-medium">Faturamento</th>
                <th className="px-2 pb-2 text-right font-medium">Margem</th>
                <th className="px-2 pb-2 text-right font-medium">Vendidos</th>
                <th className="px-2 pb-2 text-right font-medium">Estoque</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
                >
                  <td className="px-2 py-3">
                    <RankCell champion={product} />
                  </td>
                  <td className="max-w-[260px] px-2 py-3">
                    {product.productGroupId ? (
                      <Link
                        href={`/produtos/${product.productGroupId}/detalhes`}
                        className="block truncate font-medium text-foreground hover:text-primary hover:underline"
                        title={product.name}
                      >
                        {product.name}
                      </Link>
                    ) : (
                      <p className="truncate font-medium text-foreground" title={product.name}>
                        {product.name}
                      </p>
                    )}
                    <p className="truncate text-xs text-muted-foreground">{product.categoryName}</p>
                  </td>
                  <td className="px-2 py-3 text-right">
                    <p className="font-semibold tabular-nums text-foreground">
                      {formatCurrency(product.profit)}
                    </p>
                    <p className="text-[11px] tabular-nums text-muted-foreground">
                      {percent(product.profitShare)} do lucro
                    </p>
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{formatCurrency(product.revenue)}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-muted-foreground">
                    {percent(product.marginPercentage)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{product.quantitySold}</td>
                  <td className="px-2 py-3 text-right">
                    <StockCell champion={product} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(canShowMore || canShowLess) && (
        <div className="flex items-center justify-center gap-2">
          {canShowMore && (
            <Button variant="outline" size="sm" onClick={showMore} disabled={isFetching}>
              {isFetching && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Ver mais
            </Button>
          )}
          {canShowLess && (
            <Button variant="ghost" size="sm" onClick={showLess} className="text-muted-foreground">
              Ver só o top 10
            </Button>
          )}
        </div>
      )}
    </ChartCard>
  );
}

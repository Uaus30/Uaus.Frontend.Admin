import React from "react";
import { ArrowRight, Link2, Magnet } from "lucide-react";
import { formatCurrency } from "@workspace/core";
import type { BaitProduct, ProductAffinity } from "../types";

/** Bloco vazio das listas de cesta, com o motivo provável da ausência. */
function EmptyInsight({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed border-border/60">
      <p className="max-w-xs text-center text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * AffinityList
 *
 * Pares de produtos que saem juntos com mais frequência do que o acaso explicaria.
 *
 * A ordenação é pelo *lift*, não pela contagem bruta. Contagem devolveria sempre
 * os dois campeões de venda da loja — eles se encontram porque são populares, não
 * porque um puxa o outro. O lift mede exatamente esse excedente: 2,0 significa que
 * a dupla acontece o dobro do esperado se os dois fossem independentes.
 */
export function AffinityList({ items }: { items: ProductAffinity[] }) {
  if (items.length === 0) {
    return (
      <EmptyInsight message="Ainda não há pares de produtos que se repitam o suficiente para virar padrão." />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={`${item.productId}-${item.companionProductId}`}
          className="rounded-lg border border-border/60 bg-muted/10 p-3"
        >
          <div className="flex items-center gap-2 text-sm">
            <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium text-foreground" title={item.productName}>
              {item.productName}
            </span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate text-foreground" title={item.companionProductName}>
              {item.companionProductName}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground tabular-nums">
                {item.confidence.toFixed(0)}%
              </span>{" "}
              de quem leva o primeiro leva o segundo
            </span>
            <span>
              <span className="font-medium text-foreground tabular-nums">
                {item.lift.toFixed(1).replace(".", ",")}x
              </span>{" "}
              acima do acaso
            </span>
            <span className="tabular-nums">{item.togetherCount} vendas juntas</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * BaitList
 *
 * Produtos que quase nunca saem sozinhos — candidatos naturais a isca.
 *
 * O par de números que importa é a taxa de acompanhamento (quantas vendas do
 * produto tinham mais alguma coisa) e o quanto a cesta engorda quando ele
 * aparece. Um item com 95% de acompanhamento e ticket 40% maior paga uma promoção
 * na margem dele com o que o resto da cesta traz.
 *
 * O ranking desconta amostras pequenas: cinco vendas, todas acompanhadas, não é
 * um padrão — é coincidência esperando mais dados.
 */
export function BaitList({ items }: { items: BaitProduct[] }) {
  if (items.length === 0) {
    return (
      <EmptyInsight message="Nenhum produto com histórico suficiente aparece consistentemente acompanhado." />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.productId} className="rounded-lg border border-border/60 bg-muted/10 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Magnet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm font-medium text-foreground" title={item.productName}>
                  {item.productName}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {item.categoryName}
                {item.topCompanionName && ` · sai muito com ${item.topCompanionName}`}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
              {item.attachRate.toFixed(0)}% acompanhado
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Cesta média{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatCurrency(item.averageBasketValue)}
              </span>
            </span>
            {item.basketUplift > 0 && (
              <span>
                <span className="font-medium tabular-nums text-emerald-400">
                  +{item.basketUplift.toFixed(0)}%
                </span>{" "}
                acima das vendas sem ele
              </span>
            )}
            <span className="tabular-nums">
              {item.salesWithProduct} vendas · {item.salesAlone} avulsas
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

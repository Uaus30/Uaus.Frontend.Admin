import { PackageX, Sparkles } from "lucide-react";
import { Badge, Card, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { EventItemDto } from "@workspace/api-client-react";
import { BiCardHelp } from "@/components/bi-card-help";
import { BI_TONE_PILL, BI_TONE_TEXT } from "@/lib/bi-tone";
import { formatInteger, formatPercent } from "@/features/supplier-performance/lib/format";
import { EVENT_LABELS, deltaTone } from "../lib/comparison";

type EventItemsProps = {
  items: EventItemDto[];
};

/** O manual deste cartão. */
function EventsHelp() {
  return (
    <BiCardHelp titulo="Itens que sozinhos moveram o período">
      <p>
        Um produto que <strong className="text-foreground/85">passou de 5%</strong> do faturamento de um dos
        períodos e <strong className="text-foreground/85">ficou abaixo de 2%</strong> no outro. Não é "vendeu
        menos" — é <em>parou de existir</em> no resultado, ou apareceu do nada.
      </p>

      <p>
        O que só acelerou ou só desacelerou não entra aqui; esse já aparece na tabela "Quem mudou" como
        qualquer linha.
      </p>

      <p>
        O cartão nasceu de um caso real: a camiseta da Copa fez R$ 2.092 em junho de 2026 — 20% do mês — e R$
        47 em agosto. O painel mostrou o mês caindo, e nenhuma tela dizia que a queda tinha nome.
      </p>

      <p>
        <strong className="text-foreground/85">O estoque que sobrou aparece junto</strong> porque é a única
        parte do evento sobre a qual ainda dá para agir: o faturamento que não veio já passou, mas o dinheiro
        parado continua parado.
      </p>

      <p>
        Este bloco só aparece quando existe um item assim no recorte. Na maioria dos períodos, não existe — e
        isso é notícia boa.
      </p>
    </BiCardHelp>
  );
}

/**
 * Bloco 4 — o item que sozinho moveu o período.
 *
 * Nasceu de um caso concreto: a camiseta da Copa fez 20% do faturamento de junho
 * de 2026 e praticamente nada em agosto. O painel mostrou o mês caindo; nenhuma
 * tela disse que a queda tinha nome — e ainda sobraram 24 peças na prateleira.
 *
 * <b>O estoque que sobrou aparece junto</b> porque é a única parte do evento
 * sobre a qual ainda dá para agir. O faturamento que não veio já passou; o
 * dinheiro parado continua parado.
 */
export function EventItems({ items }: EventItemsProps) {
  if (items.length === 0) return null;

  return (
    <Card className="border-border/60 p-5">
      <div className="flex items-center gap-1">
        <h2 className="text-[15px] font-semibold">Itens que sozinhos moveram o período</h2>
        <EventsHelp />
      </div>
      <p className="mt-0.5 text-[11.5px] text-muted-foreground">
        passaram de 5% do faturamento de um dos lados e ficaram abaixo de 2% no outro
      </p>

      <div className="mt-4 flex flex-col gap-2.5">
        {items.map((item) => {
          const sumiu = item.kind === "Vanished";
          const tone = deltaTone(item.revenueDelta);
          const Icon = sumiu ? PackageX : Sparkles;

          return (
            <div
              key={item.productId}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                    BI_TONE_PILL[sumiu ? "ruim" : "bom"],
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-[13px] font-medium">{item.productName}</p>
                    <Badge
                      variant="outline"
                      className={cn("text-[10.5px]", BI_TONE_PILL[sumiu ? "ruim" : "bom"])}
                    >
                      {EVENT_LABELS[item.kind]}
                    </Badge>
                  </div>

                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {item.categoryName ?? "sem categoria"} · {formatCurrency(item.previousRevenue)} (
                    {formatPercent(item.previousShare, 1)}) → {formatCurrency(item.currentRevenue)} (
                    {formatPercent(item.currentShare, 1)}) · {formatInteger(item.previousUnits)} →{" "}
                    {formatInteger(item.currentUnits)} peças
                  </p>

                  {item.stock > 0 && (
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      sobraram <strong className="text-foreground/80">{formatInteger(item.stock)}</strong> em
                      estoque, {formatCurrency(item.stockCost)} de custo parado
                    </p>
                  )}
                </div>
              </div>

              <span className={cn("shrink-0 text-[15px] font-semibold tabular-nums", BI_TONE_TEXT[tone])}>
                {item.revenueDelta > 0 ? "+" : ""}
                {formatCurrency(item.revenueDelta)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

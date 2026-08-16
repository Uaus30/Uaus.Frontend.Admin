import React from "react";
import { Lightbulb } from "lucide-react";
import { Button } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Skeleton } from "@workspace/ui";
import type { useSalesIntelligence } from "../hooks/useSalesIntelligence";
import { INTELLIGENCE_WINDOWS, type IntelligenceWindow } from "../hooks/useSalesIntelligence";
import { formatBrazilianDate } from "../utils";
import { ChartCard } from "./chart-primitives";
import { AffinityList, BaitList } from "./BasketInsights";
import { RestockList } from "./RestockList";

type IntelligencePanelProps = ReturnType<typeof useSalesIntelligence>;

/**
 * IntelligencePanel
 *
 * Leituras do painel que não são "quanto vendi", e sim "o que fazer com isso":
 * o que repor antes que falte e o que sai junto no balcão.
 *
 * Também começa fechado. A análise de cesta cruza os itens de venda da janela
 * inteira contra eles mesmos — é a consulta mais cara do painel, e o resultado
 * muda em ritmo de semana, não de minuto.
 */
export function IntelligencePanel({
  intelligence,
  enabled,
  load,
  lookbackDays,
  setLookbackDays,
  isLoading,
  isFetching,
  isError,
}: IntelligencePanelProps) {
  if (!enabled) {
    return (
      <ChartCard
        title="Inteligência comercial"
        description="Reposição prioritária e produtos que saem juntos"
      >
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border/60 py-10 text-center">
          <Lightbulb className="h-8 w-8 text-muted-foreground" />
          <div className="max-w-md px-4">
            <p className="text-sm text-foreground">
              Veja o que repor primeiro e quais produtos puxam outros na mesma venda.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              A análise cruza os itens de venda do período e fica fora da carga inicial do painel.
            </p>
          </div>
          <Button onClick={load}>Analisar vendas</Button>
        </div>
      </ChartCard>
    );
  }

  const action = (
    <Select
      value={String(lookbackDays)}
      onValueChange={(value) => setLookbackDays(Number(value) as IntelligenceWindow)}
    >
      <SelectTrigger className="h-9 w-[128px] bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {INTELLIGENCE_WINDOWS.map((window) => (
          <SelectItem key={window} value={String(window)}>
            {window} dias
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <ChartCard
      title="Inteligência comercial"
      description={
        intelligence
          ? `${formatBrazilianDate(intelligence.startDate)} até ${formatBrazilianDate(intelligence.endDate)} · ${intelligence.analyzedSalesCount} vendas analisadas`
          : "Reposição prioritária e produtos que saem juntos"
      }
      action={action}
    >
      {isError && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          Não foi possível carregar a análise de vendas.
        </p>
      )}

      {isLoading || !intelligence ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-[260px] rounded-lg" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Skeleton className="h-[220px] rounded-lg" />
            <Skeleton className="h-[220px] rounded-lg" />
          </div>
        </div>
      ) : (
        <div className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <section>
            <h4 className="text-sm font-semibold text-foreground">Reposição prioritária</h4>
            <p className="mb-3 text-xs text-muted-foreground">
              Produtos com giro que estão perto de acabar, ordenados pelo lucro que a falta custaria nas
              próximas três semanas.
            </p>
            <RestockList items={intelligence.restock} lookbackDays={intelligence.lookbackDays} />
          </section>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section>
              <h4 className="text-sm font-semibold text-foreground">Compram junto</h4>
              <p className="mb-3 text-xs text-muted-foreground">
                Pares que aparecem na mesma venda acima do que o acaso explicaria.
              </p>
              <AffinityList items={intelligence.affinities} />
            </section>

            <section>
              <h4 className="text-sm font-semibold text-foreground">Oportunidades de isca</h4>
              <p className="mb-3 text-xs text-muted-foreground">
                Produtos que quase nunca saem sozinhos e engordam a cesta quando aparecem.
              </p>
              <BaitList items={intelligence.baits} />
            </section>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

import { AlertCircle, Flame, Sparkles, X } from "lucide-react";
import { Button, Card, Spinner } from "@workspace/ui";
import { AppLayout } from "@/components/layout";
import {
  useProductPerformance,
  RANKING_SIZE,
} from "@/features/product-performance/hooks/useProductPerformance";
import { PerformanceFilters } from "@/features/product-performance/components/PerformanceFilters";
import { PerformanceKpis } from "@/features/product-performance/components/PerformanceKpis";
import { PerformanceComparison } from "@/features/product-performance/components/PerformanceComparison";
import { PerformanceSuggestions } from "@/features/product-performance/components/PerformanceSuggestions";
import { PerformanceHelp } from "@/features/product-performance/components/PerformanceHelp";
import { ProductRankingTable } from "@/features/product-performance/components/ProductRankingTable";
import { ACTION_INFO } from "@/features/product-performance/lib/performance";
import { formatInteger } from "@/features/supplier-performance/lib/format";

/**
 * BI › Desempenho de Produtos.
 *
 * Duas listas e uma pergunta cada. Os melhores respondem "onde não posso deixar
 * faltar, e o que vale repetir na próxima compra"; os piores respondem "onde o
 * meu dinheiro está preso". O bloco de cima existe para as duas serem lidas
 * juntas: é lá que se vê que um terço do capital está no grupo que devolve 4% do
 * lucro.
 */
export default function ProductPerformancePage() {
  const tela = useProductPerformance();
  const relatorio = tela.report;

  const recorte = tela.action ? ACTION_INFO[tela.action].rotulo : null;
  const recorteLabel = [recorte, tela.search.trim() && `"${tela.search.trim()}"`].filter(Boolean).join(" · ");

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[27px] font-semibold tracking-tight">Desempenho de Produtos</h1>
            {relatorio && <PerformanceHelp parameters={relatorio.parameters} size={RANKING_SIZE} />}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {tela.period.label}
            </span>
            {relatorio && (
              <span className="text-[13px] text-muted-foreground">
                {formatInteger(relatorio.totals.products)} produtos analisados ·{" "}
                {formatInteger(relatorio.totals.soldProducts)} venderam em{" "}
                {formatInteger(relatorio.totals.sales)} vendas
              </span>
            )}
          </div>
        </div>

        <PerformanceFilters
          periodMode={tela.periodMode}
          preset={tela.preset}
          customStart={tela.customStart}
          setCustomStart={tela.setCustomStart}
          customEnd={tela.customEnd}
          setCustomEnd={tela.setCustomEnd}
          onSelectPreset={tela.handleSelectPreset}
          onApplyCustom={tela.handleApplyCustom}
          onClearCustom={tela.handleClearCustom}
          search={tela.search}
          onSearchChange={tela.setSearch}
          isFetching={tela.isFetching}
          onRefresh={() => void tela.refetch()}
        />

        {tela.isError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Não foi possível carregar o desempenho dos produtos. Verifique a conexão com o servidor e tente
              novamente.
            </span>
          </div>
        )}

        {tela.isLoading && (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        )}

        {relatorio && relatorio.totals.products === 0 && !tela.isLoading && (
          <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
            Nenhum produto vendeu nem tem saldo em estoque no período escolhido — não há desempenho a
            comparar.
          </Card>
        )}

        {relatorio && relatorio.totals.products > 0 && (
          <>
            <PerformanceKpis totals={relatorio.totals} />

            <PerformanceComparison comparison={relatorio.comparison} size={RANKING_SIZE} />

            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <h2 className="text-[17px] font-semibold">O que fazer com isso</h2>
              <span className="text-[12.5px] text-muted-foreground">
                clique num card para recortar as duas tabelas
              </span>
              {recorteLabel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={tela.clearFocus}
                  className="h-7 gap-1 text-xs text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                  Limpar recorte
                </Button>
              )}
            </div>

            <PerformanceSuggestions
              suggestions={relatorio.suggestions}
              selected={tela.action}
              onSelect={tela.toggleAction}
            />

            <ProductRankingTable
              title={`Os ${RANKING_SIZE} melhores`}
              description="do primeiro ao último colocado por nota — não deixe faltar, e repita o perfil na próxima compra"
              icon={Sparkles}
              variant="best"
              products={tela.best}
              total={relatorio.best.length}
              parameters={relatorio.parameters}
              focusLabel={recorteLabel || null}
              emptyMessage="Nenhum produto deste recorte entrou no ranking dos melhores."
            />

            <ProductRankingTable
              title={`Os ${RANKING_SIZE} piores`}
              description="ordenados por capital em risco — é onde o dinheiro está preso, e não onde a nota é mais baixa"
              icon={Flame}
              variant="worst"
              products={tela.worst}
              total={relatorio.worst.length}
              parameters={relatorio.parameters}
              focusLabel={recorteLabel || null}
              emptyMessage="Nenhum produto deste recorte entrou no ranking dos piores."
            />

            <p className="mt-2 border-t border-dashed border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground/80">Como a nota é calculada</strong> — média ponderada de
              quatro componentes, cada um de 0 a 100: <strong className="text-foreground/80">giro</strong> (
              {Math.round(relatorio.parameters.turnoverWeight * 100)}%, quanto do que existia saiu, contra os{" "}
              {Math.round(relatorio.parameters.storeSellThrough)}% da loja) ·{" "}
              <strong className="text-foreground/80">margem</strong> (
              {Math.round(relatorio.parameters.marginWeight * 100)}%, contra os{" "}
              {Math.round(relatorio.parameters.storeMargin)}% da loja) ·{" "}
              <strong className="text-foreground/80">resultado</strong> (
              {Math.round(relatorio.parameters.resultWeight * 100)}%, o lucro contra o lucro médio por produto
              que vendeu) · <strong className="text-foreground/80">constância</strong> (
              {Math.round(relatorio.parameters.consistencyWeight * 100)}%, em quantas semanas do período o
              produto vendeu). Quem não vendeu no período fica com zero. O ranking dos piores sai por{" "}
              <strong className="text-foreground/80">capital em risco</strong> — o custo na prateleira
              ponderado pela nota, mais o prejuízo já realizado —, porque a pergunta dele é onde está o
              dinheiro, e não onde a nota é mais baixa.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}

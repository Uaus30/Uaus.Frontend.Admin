import { AlertCircle } from "lucide-react";
import { useLocation } from "wouter";
import { Spinner } from "@workspace/ui";
import { AppLayout } from "@/components/layout";
import { useSupplierPerformance } from "@/features/supplier-performance/hooks/useSupplierPerformance";
import { SupplierPerformanceFilters } from "@/features/supplier-performance/components/SupplierPerformanceFilters";
import { SupplierPerformanceKpis } from "@/features/supplier-performance/components/SupplierPerformanceKpis";
import { SupplierConcentrationCard } from "@/features/supplier-performance/components/SupplierConcentrationCard";
import { SupplierMarginSpreadCard } from "@/features/supplier-performance/components/SupplierMarginSpreadCard";
import { SupplierRankingRow } from "@/features/supplier-performance/components/SupplierRankingRow";
import { formatPercent } from "@/features/supplier-performance/lib/format";

/**
 * BI › Desempenho de Fornecedores.
 *
 * A página não consulta nada: o `useSupplierPerformance` devolve o recorte e a
 * lista já ordenada, e aqui só se decide o que fica na tela.
 */
export default function SupplierPerformancePage() {
  const [, navigate] = useLocation();
  const tela = useSupplierPerformance();
  const relatorio = tela.report;

  const semVenda = (relatorio?.suppliers ?? []).filter((x) => x.sales === 0);
  const estoqueParadoDosSemVenda = semVenda.reduce((soma, x) => soma + x.stockCost, 0);

  return (
    <AppLayout>
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-[27px] font-semibold tracking-tight">Desempenho de Fornecedores</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
              {tela.period.label}
            </span>
            {relatorio && (
              <span className="text-[13px] text-muted-foreground">
                {relatorio.totals.activeSuppliers} de {relatorio.totals.totalSuppliers} fornecedores venderam
                no período
              </span>
            )}
          </div>
        </div>

        <SupplierPerformanceFilters
          periodMode={tela.periodMode}
          preset={tela.preset}
          customStart={tela.customStart}
          setCustomStart={tela.setCustomStart}
          customEnd={tela.customEnd}
          setCustomEnd={tela.setCustomEnd}
          onSelectPreset={tela.handleSelectPreset}
          onApplyCustom={tela.handleApplyCustom}
          onClearCustom={tela.handleClearCustom}
          sort={tela.sort}
          onSortChange={tela.setSort}
          onlyRecurring={tela.onlyRecurring}
          onOnlyRecurringChange={tela.setOnlyRecurring}
          showWithoutSales={tela.showWithoutSales}
          onShowWithoutSalesChange={tela.setShowWithoutSales}
          isFetching={tela.isFetching}
          onRefresh={() => void tela.refetch()}
        />

        {tela.isError && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>
              Não foi possível carregar o desempenho dos fornecedores. Verifique a conexão com o servidor e
              tente novamente.
            </span>
          </div>
        )}

        {tela.isLoading && (
          <div className="flex items-center justify-center py-20">
            <Spinner />
          </div>
        )}

        {relatorio && (
          <>
            <SupplierPerformanceKpis totals={relatorio.totals} parameters={relatorio.parameters} />

            <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
              <SupplierConcentrationCard
                suppliers={relatorio.suppliers}
                suppliersWithoutSales={semVenda.length}
                stockOfSuppliersWithoutSales={estoqueParadoDosSemVenda}
              />
              <SupplierMarginSpreadCard
                suppliers={relatorio.suppliers}
                storeMargin={relatorio.parameters.storeMargin}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <h2 className="text-[17px] font-semibold">Ranking de fornecedores</h2>
              <span className="text-[12.5px] text-muted-foreground">
                {tela.sort === "score" ? "do primeiro ao último colocado" : "na ordem escolhida"}
              </span>
              <div className="ml-auto flex items-center gap-2.5 text-[11.5px] text-muted-foreground">
                <span>Nota</span>
                <span>0</span>
                <span
                  className="h-2 w-40 rounded-full"
                  style={{
                    background:
                      "linear-gradient(90deg, #ef4444 0%, #f97316 30%, #eab308 55%, #22c55e 78%, #10b981 100%)",
                  }}
                  aria-hidden
                />
                <span>100</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {tela.suppliers.length === 0 ? (
                <p className="rounded-2xl border border-border/60 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
                  Nenhum fornecedor neste recorte.
                </p>
              ) : (
                tela.suppliers.map((fornecedor, indice) => (
                  <SupplierRankingRow
                    key={fornecedor.supplierId}
                    supplier={fornecedor}
                    parameters={relatorio.parameters}
                    position={indice + 1}
                    profitPosition={tela.profitRanking.posicoes.get(fornecedor.supplierId) ?? 0}
                    activeSuppliers={tela.profitRanking.total}
                    onOpen={(id) => navigate(`/bi/fornecedores/${id}`)}
                  />
                ))
              )}
            </div>

            <p className="mt-3 border-t border-dashed border-border pt-4 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground/80">Como a nota é calculada</strong> — média ponderada de
              quatro componentes, cada um de 0 a 100, todos medidos contra a própria loja no período:{" "}
              <strong className="text-foreground/80">aproveitamento do mix</strong> (
              {formatPercent(relatorio.parameters.hitRateWeight * 100, 0)}, quantos produtos do fornecedor
              vendem com margem de {formatPercent(relatorio.parameters.goodMarginThreshold, 0)} ou mais) ·{" "}
              <strong className="text-foreground/80">margem</strong> (
              {formatPercent(relatorio.parameters.marginWeight * 100, 0)}, quanto da margem média da loja o
              fornecedor alcança) · <strong className="text-foreground/80">giro</strong> (
              {formatPercent(relatorio.parameters.turnoverWeight * 100, 0)}, quanto do estoque saiu no
              período, alvo {formatPercent(relatorio.parameters.turnoverTarget, 0)}) ·{" "}
              <strong className="text-foreground/80">resultado</strong> (
              {formatPercent(relatorio.parameters.resultWeight * 100, 0)}, lucro comparado ao lucro médio por
              fornecedor). Quem tem poucos produtos julgados fica perto da média da loja, para amostra pequena
              não virar primeiro lugar por acaso. Quem não vendeu no período fica com nota zero.
            </p>
          </>
        )}
      </div>
    </AppLayout>
  );
}

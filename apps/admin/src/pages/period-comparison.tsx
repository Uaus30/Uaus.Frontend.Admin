import { AlertCircle } from "lucide-react";
import { Card, Spinner } from "@workspace/ui";
import { usePeriodComparison } from "@/features/period-comparison/hooks/usePeriodComparison";
import { ComparisonFilters } from "@/features/period-comparison/components/ComparisonFilters";
import { ComparisonHeadline } from "@/features/period-comparison/components/ComparisonHeadline";
import { RevenueBridge } from "@/features/period-comparison/components/RevenueBridge";
import { MixPricePanel } from "@/features/period-comparison/components/MixPricePanel";
import { EventItems } from "@/features/period-comparison/components/EventItems";
import { ChangeTable } from "@/features/period-comparison/components/ChangeTable";
import { ComparisonHelp } from "@/features/period-comparison/components/ComparisonHelp";
import { describeRange } from "@/features/period-comparison/lib/comparison";

/**
 * BI › O que mudou.
 *
 * A tela responde a pergunta que as outras três de BI não alcançam: não "como a
 * loja está", mas <b>por que este período fechou diferente do anterior</b>. A
 * diferença aparece repartida três vezes — entre os quatro fatores que
 * multiplicam o faturamento, entre as linhas da dimensão escolhida, e entre mix
 * e preço —, porque cada corte leva a uma ação diferente.
 */
export default function PeriodComparisonPage() {
  const tela = usePeriodComparison();
  const relatorio = tela.report;
  const semVenda = relatorio != null && relatorio.previous.revenue === 0 && relatorio.current.revenue === 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[27px] font-semibold tracking-tight">O que mudou</h1>
          {relatorio && !semVenda && <ComparisonHelp report={relatorio} />}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
            {tela.range.label}
          </span>
          <span className="text-[13px] text-muted-foreground">
            {describeRange(tela.range.previousStartDate, tela.range.previousEndDate)}
            {"  →  "}
            {describeRange(tela.range.currentStartDate, tela.range.currentEndDate)}
          </span>
        </div>
      </div>

      <ComparisonFilters
        range={tela.range}
        preset={tela.preset}
        isCustom={tela.custom != null}
        onSelectPreset={tela.handleSelectPreset}
        onApplyCustom={tela.handleApplyCustom}
        onClearCustom={tela.handleClearCustom}
        dimension={tela.dimension}
        onDimensionChange={tela.setDimension}
        isFetching={tela.isFetching}
        onRefresh={() => void tela.refetch()}
        resetToken={tela.resetToken}
      />

      {tela.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {tela.error?.message ??
              "Não foi possível carregar a comparação. Verifique a conexão com o servidor e tente novamente."}
          </span>
        </div>
      )}

      {tela.isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      )}

      {semVenda && (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          Nenhuma venda nos dois períodos escolhidos — sem vendas não há diferença a repartir.
        </Card>
      )}

      {relatorio && !semVenda && (
        <>
          <ComparisonHeadline
            previous={relatorio.previous}
            current={relatorio.current}
            leadingFactor={tela.leadingFactor}
          />

          <div className="grid items-start gap-3 xl:grid-cols-[1.1fr_1fr]">
            <RevenueBridge
              bridge={relatorio.bridge}
              total={relatorio.current.revenue - relatorio.previous.revenue}
            />
            <MixPricePanel mixPrice={relatorio.mixPrice} />
          </div>

          <EventItems items={relatorio.eventItems} />

          <ChangeTable
            changes={tela.changes}
            dimension={tela.dimension}
            search={tela.search}
            onSearchChange={tela.setSearch}
            sort={tela.sort}
            onSort={tela.ordenarPor}
            periodKey={[
              tela.range.previousStartDate,
              tela.range.previousEndDate,
              tela.range.currentStartDate,
              tela.range.currentEndDate,
            ].join("|")}
          />

          <p className="mt-2 border-t border-dashed border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground/80">O que esta tela não sabe</strong> — a primeira venda no
            sistema é de 05/03/2026, então ainda não há o mesmo período do ano anterior para comparar. Uma
            queda que seja apenas sazonal aparece aqui do mesmo jeito que uma queda estrutural, e só o
            calendário da loja distingue as duas. Faturamento é{" "}
            <strong className="text-foreground/80">Σ do total das vendas</strong>, o mesmo número do painel;
            vendas canceladas ficam de fora dos dois lados.
          </p>
        </>
      )}
    </div>
  );
}

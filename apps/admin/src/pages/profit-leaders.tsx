import { AlertCircle } from "lucide-react";
import { Card, Spinner } from "@workspace/ui";
import { useProfitLeaders } from "@/features/profit-leaders/hooks/useProfitLeaders";
import { ProfitFilters } from "@/features/profit-leaders/components/ProfitFilters";
import { ProfitHeadline } from "@/features/profit-leaders/components/ProfitHeadline";
import { ProfitPodium } from "@/features/profit-leaders/components/ProfitPodium";
import { ProfitRanking } from "@/features/profit-leaders/components/ProfitRanking";
import { ProfitLeadersHelp } from "@/features/profit-leaders/components/ProfitLeadersHelp";
import { describePeriod, PERIOD_OPTIONS } from "@/features/profit-leaders/lib/profit-leaders";

/**
 * BI › O que trouxe lucro.
 *
 * Os produtos que sozinhos compõem metade do lucro do período, com o motivo da
 * posição de cada um e o que fazer a respeito. A curva ABC responde <i>quanto do
 * resultado vem de quantos produtos</i>; esta responde <b>em quem apostar</b>.
 */
export default function ProfitLeadersPage() {
  const tela = useProfitLeaders();
  const relatorio = tela.report;
  const semLucro = relatorio != null && relatorio.summary.leaderCount === 0;
  const rotulo = PERIOD_OPTIONS.find((opcao) => opcao.value === tela.period)?.label ?? "";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[27px] font-semibold tracking-tight">O que trouxe lucro</h1>
          {relatorio && !semLucro && <ProfitLeadersHelp report={relatorio} />}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">{rotulo}</span>
          {relatorio && (
            <span className="text-[13px] text-muted-foreground">
              {describePeriod(relatorio.startDate, relatorio.endDate)}
            </span>
          )}
        </div>
      </div>

      <ProfitFilters
        period={tela.period}
        custom={tela.custom}
        measured={relatorio ? { startDate: relatorio.startDate, endDate: relatorio.endDate } : null}
        onSelectPeriod={tela.handleSelectPeriod}
        onApplyCustom={tela.handleApplyCustom}
        onClearCustom={tela.handleClearCustom}
        isFetching={tela.isFetching}
        onRefresh={() => void tela.refetch()}
        resetToken={tela.resetToken}
      />

      {tela.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {tela.error?.message ??
              "Não foi possível carregar o ranking. Verifique a conexão com o servidor e tente novamente."}
          </span>
        </div>
      )}

      {tela.isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      )}

      {semLucro && (
        <Card className="border-border/60 p-10 text-center text-sm text-muted-foreground">
          Nenhum produto deu lucro no período escolhido — sem lucro não há metade a repartir.
        </Card>
      )}

      {relatorio && !semLucro && (
        <>
          <ProfitHeadline report={relatorio} />

          <ProfitPodium podium={tela.podium} buckets={relatorio.buckets} />

          <ProfitRanking
            leaders={tela.leaders}
            buckets={relatorio.buckets}
            median={relatorio.summary.medianProfitPerUnit}
            counts={tela.counts}
            search={tela.search}
            onSearchChange={tela.setSearch}
            archetype={tela.archetype}
            onToggleArchetype={tela.toggleArchetype}
            isFiltered={tela.isFiltered}
            periodKey={`${relatorio.startDate}|${relatorio.endDate}`}
          />

          {relatorio.buckets.length === 0 && (
            <p className="text-xs leading-relaxed text-muted-foreground">
              O período escolhido é curto demais para desenhar evolução — abaixo de quatro intervalos, uma
              linha de tendência é ruído com cara de diagnóstico. O ranking continua válido.
            </p>
          )}

          <p className="mt-2 border-t border-dashed border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground/80">Aqui não existe produto ruim</strong> — todos os{" "}
            {relatorio.summary.leaderCount} chegaram ao corte. Os selos âmbar e vermelho não julgam o item:
            apontam o que olhar nele para explorar o que ele ainda tem a dar. A tela também{" "}
            <strong className="text-foreground/80">não distingue queda sazonal de queda estrutural</strong> —
            não há o mesmo período do ano anterior para comparar, e só o calendário da loja separa as duas.
          </p>
        </>
      )}
    </div>
  );
}

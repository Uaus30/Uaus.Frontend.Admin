import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, Spinner } from "@workspace/ui";
import { formatShortDate } from "@workspace/core";
import { useProductAnomalies } from "@/features/product-anomalies/hooks/useProductAnomalies";
import { AnomalyFilters } from "@/features/product-anomalies/components/AnomalyFilters";
import { AnomalyList } from "@/features/product-anomalies/components/AnomalyList";
import { AnomaliesHelp } from "@/features/product-anomalies/components/AnomaliesHelp";

/**
 * BI › Anomalias.
 *
 * O que está errado agora no cadastro dos produtos, para corrigir no próprio
 * cadastro e recarregar. As outras telas de BI dizem o que fazer com o
 * resultado; esta diz <b>o que consertar</b> para que os números delas — e o
 * balcão e o site — digam a verdade.
 */
export default function ProductAnomaliesPage() {
  const tela = useProductAnomalies();
  const relatorio = tela.report;
  const semAnomalia = relatorio != null && relatorio.items.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[27px] font-semibold tracking-tight">Anomalias</h1>
          {relatorio && <AnomaliesHelp rules={relatorio.rules} />}
        </div>
        {relatorio && (
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Varredura de {formatShortDate(relatorio.generatedAt)} às {relatorio.generatedAt.slice(11, 16)}
            {" · "}
            {tela.total === 1 ? "1 cadastro para corrigir" : `${tela.total} cadastros para corrigir`}
          </p>
        )}
      </div>

      <AnomalyFilters
        counts={tela.counts}
        total={tela.total}
        type={tela.type}
        onToggleType={tela.toggleType}
        onClearType={tela.clearType}
        search={tela.search}
        onSearchChange={tela.setSearch}
        isFetching={tela.isFetching}
        onRefresh={() => void tela.refetch()}
      />

      {tela.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            {tela.error?.message ??
              "Não foi possível carregar as anomalias. Verifique a conexão com o servidor e tente novamente."}
          </span>
        </div>
      )}

      {tela.isLoading && (
        <div className="flex items-center justify-center py-20">
          <Spinner />
        </div>
      )}

      {semAnomalia && (
        <Card className="flex items-center justify-center gap-2 border-emerald-500/30 bg-emerald-500/10 p-10 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          Nenhuma anomalia no catálogo: tudo o que esta tela sabe verificar está em ordem.
        </Card>
      )}

      {relatorio && !semAnomalia && (
        <AnomalyList
          items={tela.items}
          isFiltered={tela.isFiltered}
          filterKey={`${tela.type ?? ""}|${tela.search}`}
        />
      )}
    </div>
  );
}

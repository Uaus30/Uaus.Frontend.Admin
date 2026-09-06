import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Card } from "@workspace/ui";
import { useLowStock } from "@/features/low-stock/hooks/useLowStock";
import { LowStockTable } from "@/features/low-stock/components/LowStockTable";

/**
 * Relatório de estoque baixo.
 *
 * Renderiza o que `useLowStock` devolve: a contagem em dois cards (pendentes
 * em vermelho, resolvidos em verde) e a tabela com o "resolvido" por item.
 * Regra do §4 do CLAUDE.md: nenhuma query mora aqui.
 */
export default function LowStock() {
  const report = useLowStock();
  const pending = report.summary?.pending ?? 0;
  const resolved = report.summary?.resolved ?? 0;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Estoque baixo</h1>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            Produtos vivos com estoque mínimo configurado e saldo igual ou abaixo dele. Marque como{" "}
            <strong>resolvido</strong> o que já foi tratado (pedido feito, item a descontinuar): ele sai do
            alerta vermelho sem sair daqui, e volta a ser avaliado na próxima entrada de estoque.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card
            className={`flex items-center gap-4 p-5 ${
              pending > 0 ? "border-destructive/40 bg-destructive/5" : "border-border/60"
            }`}
          >
            <div
              className={`rounded-lg p-2 ${pending > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className={`text-3xl font-semibold ${pending > 0 ? "text-destructive" : "text-foreground"}`}>
                {report.summary ? pending : "—"}
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-4 border-border/60 p-5">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Resolvidos</p>
              <p className="text-3xl font-semibold text-foreground">{report.summary ? resolved : "—"}</p>
            </div>
          </Card>
        </div>

        <LowStockTable
          items={report.items}
          isLoading={report.isLoading}
          search={report.search}
          setSearch={report.setSearch}
          maxStock={report.maxStock}
          setMaxStock={report.setMaxStock}
          includeResolved={report.includeResolved}
          setIncludeResolved={report.setIncludeResolved}
          page={report.page}
          totalPages={report.totalPages}
          setPage={report.setPage}
          onResolve={report.resolve}
          onReopen={report.reopen}
          mutatingProductId={report.mutatingProductId}
        />
      </div>
    </AppLayout>
  );
}

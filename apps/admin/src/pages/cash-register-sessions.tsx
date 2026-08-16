import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import {
  PAGE_SIZE,
  useCashRegisterSessions,
} from "@/features/cash-register-sessions/hooks/useCashRegisterSessions";
import { CashRegisterSessionsTable } from "@/features/cash-register-sessions/components/CashRegisterSessionsTable";
import { CashRegisterSessionDetailsDialog } from "@/features/cash-register-sessions/components/CashRegisterSessionDetailsDialog";
import { RefreshCw, Wallet } from "lucide-react";

export default function CashRegisterSessionsPage() {
  const {
    sessions,
    pagination,
    isLoading,
    page,
    setPage,
    statusFilter,
    setStatusFilter,
    startDate,
    endDate,
    setPeriod,
    detailsOpen,
    selectedSession,
    isLoadingDetails,
    openDetails,
    closeDetails,
    refetch,
  } = useCashRegisterSessions();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                Sessões de Caixa
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Acompanhe os turnos de caixa do PDV: abertura, fechamento e conferência da gaveta de cada
              operador.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            title="Atualizar dados"
            className="hover-elevate"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Filtros + Tabela */}
        <CashRegisterSessionsTable
          isLoading={isLoading}
          sessions={sessions}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          startDate={startDate}
          endDate={endDate}
          onPeriodChange={setPeriod}
          onRowClick={openDetails}
        />

        {/* Paginação */}
        {pagination && pagination.filteredItems > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Total: {pagination.filteredItems} sessões de caixa</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>

              <span>
                Página {page} de {pagination.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}

        {/* Detalhe do turno */}
        <CashRegisterSessionDetailsDialog
          open={detailsOpen}
          onOpenChange={(open) => {
            if (!open) closeDetails();
          }}
          session={selectedSession}
          isLoading={isLoadingDetails}
        />
      </div>
    </AppLayout>
  );
}

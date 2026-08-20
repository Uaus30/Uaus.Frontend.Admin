import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { LogsFilterBar } from "@/features/logs/components/LogsFilterBar";
import { LogsTable } from "@/features/logs/components/LogsTable";
import { useLogs } from "@/features/logs/hooks/useLogs";

/**
 * Página principal de Logs do Sistema.
 * Desenvolvida sob os padrões AI-First, desacoplada em filtros, tabela e hook de controle.
 */
export default function Logs() {
  const [, setLocation] = useLocation();

  const {
    draftSearch,
    setDraftSearch,
    draftType,
    setDraftType,
    draftDateRange,
    setDraftDateRange,
    page,
    setPage,
    logTypeOptions,
    selectableLogTypeOptions,
    data,
    isLoading,
    logsList,
    handleSearch,
    handleKeyDown,
  } = useLogs();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Logs do Sistema</h1>
          <p className="mt-1 text-muted-foreground">Monitore os eventos, requisições e erros do sistema.</p>
        </div>

        <LogsFilterBar
          draftSearch={draftSearch}
          onSearchChange={setDraftSearch}
          draftType={draftType}
          onTypeChange={setDraftType}
          selectableLogTypeOptions={selectableLogTypeOptions}
          draftDateRange={draftDateRange}
          onDateRangeChange={setDraftDateRange}
          onSearch={handleSearch}
          onKeyDown={handleKeyDown}
          isLoading={isLoading}
        />

        <LogsTable
          logsList={logsList}
          logTypeOptions={logTypeOptions}
          isLoading={isLoading}
          onRowClick={(id) => setLocation(`/sistema/logs/${id}`)}
        />

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground">
              Página {page} de {data.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page === data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

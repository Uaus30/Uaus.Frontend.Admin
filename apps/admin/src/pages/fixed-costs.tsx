import { AppLayout } from "@/components/layout";
import { PAGE_SIZE, useFixedCosts } from "@/features/fixed-costs/hooks/useFixedCosts";
import { FixedCostsTable } from "@/features/fixed-costs/components/FixedCostsTable";
import { FixedCostEditorModal } from "@/features/fixed-costs/components/FixedCostEditorModal";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Plus, ReceiptText, Search } from "lucide-react";

/** Página de custos fixos (rota futura /financeiro/custos-fixos). */
export default function FixedCostsPage() {
  const {
    fixedCosts,
    pagination,
    isLoading,
    page,
    setPage,
    searchInput,
    setSearchInput,
    modalOpen,
    editingId,
    form,
    setForm,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmit,
    isSaving,
    handleEndFixedCost,
    handleDelete,
    isEnding,
    isDeleting,
  } = useFixedCosts();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ReceiptText className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Custos Fixos</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre os custos mensais recorrentes (aluguel, contador, energia...) que entram no fechamento
              financeiro.
            </p>
          </div>

          <Button onClick={handleOpenCreate} className="gap-2 hover-elevate">
            <Plus className="w-4 h-4" /> Novo Custo Fixo
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-4 rounded-xl border shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome do custo fixo..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Tabela */}
        <FixedCostsTable
          items={fixedCosts}
          isLoading={isLoading}
          isEnding={isEnding}
          isDeleting={isDeleting}
          onEdit={handleOpenEdit}
          onEnd={handleEndFixedCost}
          onDelete={handleDelete}
        />

        {/* Paginação */}
        {pagination && pagination.total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Total: {pagination.total} custos fixos</span>
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

        {/* Modal Editor */}
        <FixedCostEditorModal
          open={modalOpen}
          editingId={editingId}
          form={form}
          onFormChange={setForm}
          onClose={handleCloseModal}
          onSubmit={handleSubmit}
          isSaving={isSaving}
        />
      </div>
    </AppLayout>
  );
}

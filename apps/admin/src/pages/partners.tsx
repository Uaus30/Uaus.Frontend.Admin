import { AppLayout } from "@/components/layout";
import { PAGE_SIZE, usePartners } from "@/features/partners/hooks/usePartners";
import { PartnersTable } from "@/features/partners/components/PartnersTable";
import { PartnerEditorModal } from "@/features/partners/components/PartnerEditorModal";
import { ProfitSharesCard } from "@/features/partners/components/ProfitSharesCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Handshake } from "lucide-react";

/**
 * Página de Sócios (rota futura /financeiro/socios).
 *
 * Duas seções: o cadastro dos sócios (CRUD) e a distribuição de lucros — os
 * percentuais que o fechamento financeiro congela a cada confirmação.
 */
export default function PartnersPage() {
  const {
    searchVal,
    setSearchVal,
    page,
    setPage,
    partners,
    pagination,
    isLoading,
    modalOpen,
    editingId,
    editingWasActive,
    form,
    setForm,
    handleOpenModal,
    closeModal,
    handleSubmitPartner,
    handleDeletePartner,
    isSaving,
    isDeleting,
    activeShares,
    isLoadingShares,
    draftPercentages,
    setSharePercentage,
    handleSharePercentageBlur,
    sharesSum,
    isSharesSumValid,
    canSaveShares,
    handleSaveShares,
    isSavingShares,
  } = usePartners();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Handshake className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Sócios</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Cadastre os sócios da empresa e configure a distribuição de lucros usada nos fechamentos financeiros.
            </p>
          </div>

          <Button onClick={() => handleOpenModal()} className="gap-2 hover-elevate">
            <Plus className="w-4 h-4" /> Novo Sócio
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
          {/* Seção 1: cadastro de sócios */}
          <div className="xl:col-span-2 space-y-6">
            {/* Filtros */}
            <div className="flex items-center gap-3 bg-card p-4 rounded-xl border shadow-sm">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome do sócio..."
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Tabela */}
            <PartnersTable
              partners={partners}
              isLoading={isLoading}
              isDeleting={isDeleting}
              onEdit={handleOpenModal}
              onDelete={handleDeletePartner}
            />

            {/* Paginação */}
            {pagination && pagination.filteredItems > PAGE_SIZE && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Total: {pagination.filteredItems} sócios</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Anterior
                  </Button>

                  <span>Página {page} de {pagination.totalPages}</span>

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
          </div>

          {/* Seção 2: distribuição de lucros */}
          <ProfitSharesCard
            shares={activeShares}
            isLoading={isLoadingShares}
            draftPercentages={draftPercentages}
            onPercentageChange={setSharePercentage}
            onPercentageBlur={handleSharePercentageBlur}
            sum={sharesSum}
            isSumValid={isSharesSumValid}
            canSave={canSaveShares}
            isSaving={isSavingShares}
            onSubmit={handleSaveShares}
          />
        </div>

        {/* Modal Editor */}
        <PartnerEditorModal
          open={modalOpen}
          editingId={editingId}
          editingWasActive={editingWasActive}
          formData={form}
          onClose={closeModal}
          onFormChange={setForm}
          onSubmit={handleSubmitPartner}
          isSaving={isSaving}
        />
      </div>
    </AppLayout>
  );
}

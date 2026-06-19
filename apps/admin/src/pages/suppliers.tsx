import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { SupplierEditorModal } from "@/features/suppliers/components/SupplierEditorModal";
import { SuppliersTable } from "@/features/suppliers/components/SuppliersTable";
import { useSuppliers } from "@/features/suppliers/hooks/useSuppliers";
import { Plus } from "lucide-react";

/**
 * Página principal de Fornecedores do Painel Administrativo.
 * Totalmente desacoplada, utilizando a arquitetura AI-First.
 */
export default function Suppliers() {
  const {
    searchVal,
    setSearchVal,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    limit,
    setLimit,
    modalOpen,
    setModalOpen,
    editingId,
    saving,
    form,
    statusOptions,
    statusLabelById,
    selectableSupplierStatusOptions,
    activeStatusValue,
    suppliersPage,
    isLoading,
    isError,
    error,
    suppliers,
    handleOpenModal,
    handleSubmitSupplier,
    handleDeleteSupplier,
  } = useSuppliers();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Fornecedores</h1>
            <p className="mt-1 text-muted-foreground">Gerencie seus fornecedores e contatos comerciais.</p>
          </div>
          <Button onClick={() => handleOpenModal()} className="bg-primary text-primary-foreground hover-elevate">
            <Plus className="mr-2 h-4 w-4" /> Novo Fornecedor
          </Button>
        </div>

        <SuppliersTable
          searchVal={searchVal}
          onSearchChange={setSearchVal}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          statusOptions={statusOptions}
          statusLabelById={statusLabelById}
          suppliers={suppliers}
          page={page}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={setLimit}
          suppliersPage={suppliersPage}
          isLoading={isLoading}
          isError={isError}
          error={error}
          onEdit={handleOpenModal}
          onDelete={handleDeleteSupplier}
        />
      </div>

      <SupplierEditorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingId={editingId}
        initialForm={form}
        saving={saving}
        selectableSupplierStatusOptions={selectableSupplierStatusOptions}
        activeStatusValue={activeStatusValue}
        onSubmit={handleSubmitSupplier}
      />
    </AppLayout>
  );
}

import { Button } from "@workspace/ui";
import { CustomerEditorModal } from "@/features/customers/components/CustomerEditorModal";
import { CustomerLoyaltyDialog } from "@/features/customers/components/CustomerLoyaltyDialog";
import { useCustomerLoyalty } from "@/features/customers/hooks/useCustomerLoyalty";
import { CustomersTable } from "@/features/customers/components/CustomersTable";
import { useCustomers } from "@/features/customers/hooks/useCustomers";
import { Plus } from "lucide-react";

/**
 * Página principal de Clientes do Painel Administrativo.
 * Utiliza a arquitetura AI-First, consumindo o hook useCustomers e componentes puros de UI.
 */
export default function Customers() {
  const {
    customersPage,
    isLoading,
    searchVal,
    setSearchVal,
    page,
    setPage,
    modalOpen,
    setModalOpen,
    editingId,
    formData,
    statsByCustomerId,
    isSaving,
    defaultAreaCode,
    defaultCity,
    handleOpenModal,
    handleDeleteCustomer,
    isDeleting,
    handleSaveCustomer,
  } = useCustomers();
  const loyalty = useCustomerLoyalty();

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">Clientes</h1>
            <p className="mt-1 text-muted-foreground">Gerencie sua base de clientes e histórico.</p>
          </div>
          <Button
            onClick={() => handleOpenModal()}
            className="bg-primary text-primary-foreground hover-elevate"
          >
            <Plus className="mr-2 h-4 w-4" /> Novo Cliente
          </Button>
        </div>

        <CustomersTable
          isDeleting={isDeleting}
          customersPage={customersPage}
          isLoading={isLoading}
          searchVal={searchVal}
          onSearchChange={setSearchVal}
          page={page}
          onPageChange={setPage}
          statsByCustomerId={statsByCustomerId}
          onEdit={handleOpenModal}
          onDelete={handleDeleteCustomer}
          onOpenLoyalty={loyalty.open}
        />
      </div>

      <CustomerLoyaltyDialog
        customerName={loyalty.customer?.name ?? null}
        statement={loyalty.statement}
        isLoading={loyalty.isLoading}
        onClose={loyalty.close}
        onPrint={loyalty.print}
        onAdjust={loyalty.adjust}
        isAdjusting={loyalty.isAdjusting}
      />

      <CustomerEditorModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        editingId={editingId}
        initialForm={formData}
        defaultAreaCode={defaultAreaCode}
        defaultCity={defaultCity}
        isSaving={isSaving}
        onSubmit={handleSaveCustomer}
      />
    </>
  );
}

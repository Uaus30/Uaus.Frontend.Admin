import { AppLayout } from "@/components/layout";
import { usePaymentMethods } from "@/features/payment-methods/hooks/usePaymentMethods";
import { PaymentMethodsTable } from "@/features/payment-methods/components/PaymentMethodsTable";
import { PaymentMethodEditorModal } from "@/features/payment-methods/components/PaymentMethodEditorModal";
import { Button } from "@workspace/ui";
import { Input } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { TablePagination } from "@workspace/ui";
import { Plus, Search, CreditCard, RefreshCw } from "lucide-react";

export default function PaymentMethodsPage() {
  const {
    items,
    isLoading,
    page,
    setPage,
    pagination,
    search,
    setSearch,
    isActiveFilter,
    setIsActiveFilter,
    modalOpen,
    editingId,
    formData,
    setFormData,
    openCreateModal,
    openEditModal,
    closeModal,
    handleAddInstallment,
    handleRemoveInstallment,
    handleInstallmentChange,
    handleSubmit,
    handleDelete,
    isSaving,
    refetch,
  } = usePaymentMethods();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CreditCard className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                Formas de Pagamento
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie as formas de pagamento disponíveis para os clientes e configure as taxas por
              parcelamento.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              title="Atualizar dados"
              className="hover-elevate"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>

            <Button onClick={openCreateModal} className="gap-2 hover-elevate">
              <Plus className="w-4 h-4" /> Nova Forma de Pagamento
            </Button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row items-center gap-3 bg-card p-4 rounded-xl border shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome da forma de pagamento..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <div className="w-full sm:w-48">
            <Select
              value={isActiveFilter}
              onValueChange={(val) => {
                setIsActiveFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="true">Apenas Ativas</SelectItem>
                <SelectItem value="false">Apenas Inativas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabela */}
        <PaymentMethodsTable
          items={items}
          isLoading={isLoading}
          onEdit={openEditModal}
          onDelete={handleDelete}
        />

        {/* Paginação */}
        {pagination && (
          <TablePagination
            page={page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onPageChange={setPage}
            itemLabel={{ singular: "forma de pagamento", plural: "formas de pagamento" }}
          />
        )}

        {/* Modal Editor */}
        <PaymentMethodEditorModal
          open={modalOpen}
          editingId={editingId}
          formData={formData}
          onClose={closeModal}
          onFormChange={setFormData}
          onAddInstallment={handleAddInstallment}
          onRemoveInstallment={handleRemoveInstallment}
          onInstallmentChange={handleInstallmentChange}
          onSubmit={handleSubmit}
          isSaving={isSaving}
        />
      </div>
    </AppLayout>
  );
}

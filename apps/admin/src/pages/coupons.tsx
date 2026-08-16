import { AppLayout } from "@/components/layout";
import { PAGE_SIZE, useCoupons } from "@/features/coupons/hooks/useCoupons";
import { CouponsTable } from "@/features/coupons/components/CouponsTable";
import { CouponsFilters } from "@/features/coupons/components/CouponsFilters";
import { CouponEditorModal } from "@/features/coupons/components/CouponEditorModal";
import { CouponConfirmDialog } from "@/features/coupons/components/CouponConfirmDialog";
import { Button } from "@workspace/ui";
import { Plus, TicketPercent } from "lucide-react";

/**
 * Página de cupons de desconto (rota `/marketing/cupons`, papel Admin).
 *
 * Não há query nem mutação aqui: tudo vem de `useCoupons`. A página só desenha.
 */
export default function CouponsPage() {
  const {
    coupons,
    pagination,
    isLoading,
    page,
    setPage,
    searchInput,
    setSearchInput,
    onlyActive,
    setOnlyActive,
    campaignFilter,
    setCampaignFilter,
    campaigns,
    modalOpen,
    editing,
    form,
    setForm,
    handleOpenCreate,
    handleOpenEdit,
    handleCloseModal,
    handleSubmit,
    isSaving,
    handleDelete,
    confirmRequest,
    handleConfirmAccept,
    handleConfirmDismiss,
    isConfirming,
  } = useCoupons();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <TicketPercent className="w-6 h-6 text-primary" />
              <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">
                Cupons
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Códigos de desconto do panfleto: valor, vigência e teto de resgates. O balcão aplica
              pelo código; o histórico de cada venda guarda o cupom como ele era no dia.
            </p>
          </div>

          <Button onClick={handleOpenCreate} className="gap-2 hover-elevate">
            <Plus className="w-4 h-4" /> Novo Cupom
          </Button>
        </div>

        {/* Filtros */}
        <CouponsFilters
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          onlyActive={onlyActive}
          onOnlyActiveChange={setOnlyActive}
          campaignFilter={campaignFilter}
          onCampaignFilterChange={setCampaignFilter}
          campaigns={campaigns}
        />

        {/* Tabela */}
        <CouponsTable
          items={coupons}
          isLoading={isLoading}
          isBusy={isConfirming}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
        />

        {/* Paginação */}
        {pagination && pagination.total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Total: {pagination.total} cupons</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
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

        {/* Formulário */}
        <CouponEditorModal
          open={modalOpen}
          editing={editing}
          form={form}
          onFormChange={setForm}
          onClose={handleCloseModal}
          onSubmit={handleSubmit}
          isSaving={isSaving}
          campaigns={campaigns}
        />

        {/* Confirmação de excluir / desativar / alterar cupom resgatado */}
        <CouponConfirmDialog
          request={confirmRequest}
          onAccept={handleConfirmAccept}
          onDismiss={handleConfirmDismiss}
          loading={isConfirming}
        />
      </div>
    </AppLayout>
  );
}

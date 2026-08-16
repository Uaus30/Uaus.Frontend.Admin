import { AppLayout } from "@/components/layout";
import { PAGE_SIZE, useCampaigns } from "@/features/campaigns/hooks/useCampaigns";
import { CampaignsTable } from "@/features/campaigns/components/CampaignsTable";
import { CampaignEditorModal } from "@/features/campaigns/components/CampaignEditorModal";
import { Button, Input } from "@workspace/ui";
import { Megaphone, Plus, Search } from "lucide-react";

/**
 * Página de Campanhas (rota `/marketing/campanhas`, papel Admin).
 *
 * A campanha reúne cupons e um questionário curto para o caixa. O que ela
 * decide é **se o questionário aparece** — o desconto, o prazo e o limite de
 * uso são do cupom, na tela de Cupons.
 */
export default function CampaignsPage() {
  const {
    campaigns,
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
    questions,
    setQuestions,
    isLoadingDetail,
    handleOpenCreate,
    handleOpenEdit,
    closeModal,
    handleSubmit,
    isSaving,
    linkedCoupons,
    linkedCouponsTotal,
    isLoadingCoupons,
    handleCreateLinkedCoupon,
    handleDelete,
    isDeleting,
  } = useCampaigns();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-primary" />
              <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">Campanhas</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Agrupe cupons e pergunte no caixa como o cliente chegou até a loja. O período da campanha decide
              quando o questionário aparece; o desconto é do cupom.
            </p>
          </div>

          <Button onClick={handleOpenCreate} className="gap-2 hover-elevate">
            <Plus className="h-4 w-4" /> Nova Campanha
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-4 shadow-sm sm:flex-row">
          <div className="relative w-full flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome da campanha..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Tabela */}
        <CampaignsTable
          items={campaigns}
          isLoading={isLoading}
          isDeleting={isDeleting}
          onEdit={handleOpenEdit}
          onDelete={handleDelete}
        />

        {/* Paginação */}
        {pagination && pagination.total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Total: {pagination.total} campanhas</span>
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
        <CampaignEditorModal
          open={modalOpen}
          editingId={editingId}
          form={form}
          onFormChange={setForm}
          questions={questions}
          onQuestionsChange={setQuestions}
          isLoadingDetail={isLoadingDetail}
          linkedCoupons={linkedCoupons}
          linkedCouponsTotal={linkedCouponsTotal}
          isLoadingCoupons={isLoadingCoupons}
          onCreateLinkedCoupon={() => editingId != null && handleCreateLinkedCoupon(editingId)}
          onClose={closeModal}
          onSubmit={handleSubmit}
          isSaving={isSaving}
        />
      </div>
    </AppLayout>
  );
}

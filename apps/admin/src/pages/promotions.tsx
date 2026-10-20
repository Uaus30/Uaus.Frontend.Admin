import { usePageTitle } from "@/hooks/use-page-title";
import { Button } from "@workspace/ui";
import { Plus, Printer, Zap } from "lucide-react";
import { PAGE_SIZE, usePromotions } from "@/features/promotions/hooks/usePromotions";
import { PromotionsFilters } from "@/features/promotions/components/PromotionsFilters";
import { PromotionsTable } from "@/features/promotions/components/PromotionsTable";
import { PromotionEditorScreen } from "@/features/promotions/components/PromotionEditorScreen";
import { usePromotionBanner } from "@/features/promotions/hooks/usePromotionBanner";
import { PromotionBannerDialog } from "@/features/promotions/components/PromotionBannerDialog";

/**
 * Página de Promoções (rota `/marketing/promocoes`).
 *
 * Três telas numa entrada de rota só — listagem, cadastro e detalhe. É o mesmo
 * desenho da página de Produtos, e pelo mesmo motivo: entradas separadas no
 * `<Switch>` desmontariam a listagem ao abrir o detalhe, e voltar devolveria a
 * pessoa a uma lista recém-nascida, sem filtro nem página.
 *
 * Não há query nem mutação aqui: tudo vem dos hooks. A página só desenha.
 */
export default function PromotionsPage() {
  const {
    screen,
    promotions,
    pagination,
    isLoading,
    page,
    setPage,
    searchInput,
    setSearchInput,
    typeFilter,
    setTypeFilter,
    onlyActive,
    setOnlyActive,
    abrirNova,
    abrirDetalhe,
    repetir,
    voltarParaLista,
    aoSalvar,
    encerrar,
    excluir,
    isBusy,
    tipos,
  } = usePromotions();

  // Antes do `return` da outra tela: hook é hook, e a modal só consulta aberta.
  const banner = usePromotionBanner();

  usePageTitle("Promoções");

  if (screen.kind !== "lista") {
    return (
      <PromotionEditorScreen
        promotionId={screen.kind === "detalhe" ? screen.id : undefined}
        onBack={voltarParaLista}
        onSaved={aoSalvar}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-display font-bold tracking-tight text-foreground">Promoções</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Preço promocional por produto, com vigência própria. O cadastro do produto não é alterado — o
            preço volta sozinho quando a promoção acaba.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* O banner impresso (16/10/2026): seis quadrados por folha A4, a partir das
              promoções no ar e programadas. Nada é gravado — a aba aberta é a
              reimpressão. */}
          <Button variant="outline" onClick={banner.abrir} className="gap-2 hover-elevate">
            <Printer className="h-4 w-4" /> Imprimir Banner
          </Button>
          <Button onClick={abrirNova} className="gap-2 hover-elevate">
            <Plus className="h-4 w-4" /> Nova Promoção
          </Button>
        </div>
      </div>

      <PromotionsFilters
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        onlyActive={onlyActive}
        onOnlyActiveChange={setOnlyActive}
        tipos={tipos}
      />

      <PromotionsTable
        items={promotions}
        isLoading={isLoading}
        isBusy={isBusy}
        onOpen={(promotion) => abrirDetalhe(promotion.id)}
        onRepeat={(promotion) => repetir(promotion.id)}
        onEnd={(promotion) => encerrar(promotion.id)}
        onDelete={(promotion) => excluir(promotion.id)}
      />

      {pagination && pagination.total > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Total: {pagination.total} promoções</span>
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

      <PromotionBannerDialog
        open={banner.open}
        onOpenChange={banner.onOpenChange}
        candidates={banner.candidates}
        isLoading={banner.isLoading}
        title={banner.title}
        onTitleChange={banner.setTitle}
        editOf={banner.editOf}
        onToggle={banner.toggle}
        onNameChange={banner.setName}
        onCopiesChange={banner.setCopies}
        bannerCount={banner.bannerCount}
        onPrint={() => void banner.imprimir()}
      />
    </div>
  );
}

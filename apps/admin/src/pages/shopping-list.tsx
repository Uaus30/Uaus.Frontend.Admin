import { FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@workspace/ui";
import { ALL_OPTION, useShoppingList } from "@/features/low-stock/hooks/useShoppingList";
import { ShoppingListFilters } from "@/features/low-stock/components/ShoppingListFilters";
import { ShoppingListTable } from "@/features/low-stock/components/ShoppingListTable";
import { ReportTotalBar } from "@/features/low-stock/components/ReportTotalBar";

/**
 * Lista de Compras (14/10/2026): o que vale comprar na próxima viagem ou no
 * próximo pedido.
 *
 * Renderiza o que `useShoppingList` devolve. Regra do §4 do CLAUDE.md: nenhuma
 * query mora aqui.
 */
export default function ShoppingList() {
  const list = useShoppingList();
  const filtered =
    list.supplierId !== ALL_OPTION ||
    list.city !== ALL_OPTION ||
    Boolean(list.search.trim()) ||
    Boolean(list.minRecentSales.trim());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Lista de Compras</h1>
          <p className="mt-1 max-w-4xl text-sm text-muted-foreground">
            O que vale comprar na <strong>próxima viagem ou pedido</strong>: produtos com{" "}
            <strong>boa saída</strong> que esgotaram, duram menos de 30 dias ou chegaram ao estoque mínimo —
            tanto os controlados quanto os que ficaram fora do controle por{" "}
            <strong>&quot;Planejar viagem&quot;</strong> (compra pequena de atacado ou varejo). Filtre pelo{" "}
            <strong>fornecedor</strong> ou pela <strong>cidade</strong> da viagem. Quem já tem compra A
            caminho fica de fora; marque a caixa para ver tudo.
          </p>
        </div>
        <Button
          onClick={list.exportToXlsx}
          disabled={list.isExporting}
          className="shrink-0 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {list.isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          Exportar XLSX
        </Button>
      </div>

      <div className="space-y-4 rounded-2xl border border-border/50 bg-card/50 p-3 sm:p-5">
        <ShoppingListFilters
          allValue={ALL_OPTION}
          supplierId={list.supplierId}
          setSupplierId={list.setSupplierId}
          supplierOptions={list.supplierOptions}
          city={list.city}
          setCity={list.setCity}
          cityOptions={list.cityOptions}
          search={list.search}
          setSearch={list.setSearch}
          minRecentSales={list.minRecentSales}
          setMinRecentSales={list.setMinRecentSales}
        />

        <ReportTotalBar
          total={list.total}
          isLoading={list.isLoading}
          includePurchasesInTransit={list.includePurchasesInTransit}
          onIncludePurchasesInTransitChange={list.setIncludePurchasesInTransit}
        />

        <ShoppingListTable
          items={list.items}
          isLoading={list.isLoading}
          filtered={filtered}
          page={list.page}
          totalPages={list.totalPages}
          setPage={list.setPage}
          onComprar={list.comprar}
        />
      </div>
    </div>
  );
}

import { Calendar, Eye, Package, Plus, Receipt } from "lucide-react";
import { Badge, Button } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { formatQuantity } from "@workspace/core";
import { PURCHASE_ENTRY_TYPE, enumCode } from "@workspace/api-client-react";
import { useProductStockEntries } from "@/features/stock-entries/hooks/useProductStockEntries";
import { StockEntryDetailsModal } from "@/features/stock-entries/components/StockEntryDetailsModal";
import { SimpleStockEntryModal } from "@/features/stock-entries/components/SimpleStockEntryModal";
import type { StockEntryPrefill } from "@/features/stock-entries/types";
import { formatCurrency } from "@workspace/core";

/** Uma variação já gravada, para o seletor de qual SKU a aba está mostrando. */
export type StockTabProductOption = {
  id: number;
  name: string;
};

type ProductStockTabProps = {
  /** Produto cujas entradas a aba lista. `null` enquanto o cadastro não foi salvo. */
  productId: number | null;
  productName: string;
  barcode: string | null;
  /** Variações gravadas do grupo. Vazio em produto simples — o seletor não aparece. */
  variationOptions: StockTabProductOption[];
  onSelectProduct: (productId: number) => void;
  /** Entrada pré-preenchida por uma compra de produto novo. A modal abre sozinha com ela. */
  entryPrefill?: StockEntryPrefill | null;
  /** Chamado com o id da entrada gravada — fecha a compra que originou o cadastro. */
  onEntrySaved?: (entryId: number) => void;
};

/**
 * Aba **Estoque**: o que já entrou deste produto e o botão de lançar mais.
 *
 * As entradas vêm ordenadas da mais recente para a mais antiga — a ordenação é
 * do backend (data de entrada decrescente e, no empate, id decrescente), não da
 * tela. Uma nota retroativa NÃO vai para o topo: ela cai no dia que o operador
 * escolheu, que é a ordenação funcionando, não um defeito.
 *
 * O valor da linha é o total da NOTA inteira, e não o deste produto: a listagem
 * de notas não quebra por item. Quem quer a quantidade e o custo deste produto
 * abre os detalhes pelo olho.
 */
export function ProductStockTab({
  productId,
  productName,
  barcode,
  variationOptions,
  onSelectProduct,
  entryPrefill = null,
  onEntrySaved,
}: ProductStockTabProps) {
  const stock = useProductStockEntries(productId, { prefill: entryPrefill, onEntrySaved });
  const entries = stock.entriesData?.data ?? [];

  if (productId === null) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-background/40 p-10 text-center">
        <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground opacity-20" />
        <p className="text-sm font-medium text-foreground">Salve o produto para movimentar o estoque</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A entrada de mercadoria precisa de um produto já cadastrado para lançar o lote.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-background/40 p-5">
      {entryPrefill && (
        <p
          data-testid="purchase-prefill-banner"
          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-300"
        >
          Recebimento da compra: {formatQuantity(entryPrefill.quantity)} un. a{" "}
          {formatCurrency(entryPrefill.unitCost)} cada. A entrada abre preenchida — confira e salve para
          lançar a compra.
        </p>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Entradas deste produto
          </h2>
          <p className="text-xs text-muted-foreground">
            Estoque atual:{" "}
            <span className="font-semibold text-foreground">
              {stock.product ? formatQuantity(stock.product.stock) : "—"}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {variationOptions.length > 0 && (
            <Select value={String(productId)} onValueChange={(value) => onSelectProduct(Number(value))}>
              <SelectTrigger className="h-9 w-full sm:w-[260px]" aria-label="Variação">
                <SelectValue placeholder="Selecione a variação" />
              </SelectTrigger>
              <SelectContent>
                {variationOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/*
            Desabilitado até o produto chegar: abrir antes preencheria custo e
            preço com 0 — e o preço lançado passa a valer no cadastro.
          */}
          <Button
            type="button"
            onClick={stock.openNewEntry}
            disabled={!stock.product}
            className="gap-2 bg-primary text-primary-foreground hover-elevate"
          >
            <Plus className="h-4 w-4" /> Registrar Entrada
          </Button>
        </div>
      </div>

      {stock.isLoadingEntries ? (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      ) : entries.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          <Receipt className="mx-auto mb-3 h-12 w-12 opacity-20" />
          <p>Nenhuma entrada de estoque para este produto.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-4 py-3">Data de Entrada</TableHead>
                <TableHead className="px-4 py-3">Nº da Nota</TableHead>
                <TableHead className="px-4 py-3">Fornecedor</TableHead>
                <TableHead className="px-4 py-3 text-right">Total da Nota</TableHead>
                <TableHead className="w-24 px-4 py-3 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const supplier = stock.suppliers.find((s) => s.id === entry.supplierId);
                return (
                  <TableRow key={entry.id} className="transition-colors hover:bg-muted/10">
                    <TableCell className="px-4 py-3 text-sm">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {stock.formatShortDate(entry.entryDate)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 font-mono text-sm">
                      {enumCode(entry.type, PURCHASE_ENTRY_TYPE) === PURCHASE_ENTRY_TYPE.ManualAdjustment ? (
                        <Badge variant="outline" className="font-sans font-normal">
                          Ajuste manual
                        </Badge>
                      ) : (
                        entry.invoiceNumber || "-"
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-sm font-medium">
                      {supplier?.name || "Não informado"}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right text-sm font-semibold text-emerald-500">
                      {stock.formatCurrency(entry.total)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Ver detalhes da entrada ${entry.id}`}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => stock.openDetails(entry.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {stock.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={stock.page === 1}
            onClick={() => stock.setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="text-xs text-muted-foreground">
            Página {stock.page} de {stock.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={stock.page === stock.totalPages}
            onClick={() => stock.setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}

      <StockEntryDetailsModal
        open={stock.detailsModalOpen}
        onOpenChange={stock.setDetailsModalOpen}
        selectedEntryId={stock.selectedEntryId}
        entryDetails={stock.entryDetails}
        isLoadingDetails={stock.isLoadingDetails}
        formatCurrency={stock.formatCurrency}
        formatShortDate={stock.formatShortDate}
        onDelete={stock.deleteEntry}
      />

      <SimpleStockEntryModal
        open={stock.newEntryModalOpen}
        onOpenChange={stock.setNewEntryModalOpen}
        productName={productName}
        barcode={barcode}
        currentStock={stock.product?.stock ?? null}
        suppliers={stock.suppliers}
        form={stock.form}
        onChange={stock.updateForm}
        isSaving={stock.isSavingEntry}
        onSubmit={stock.handleSaveEntry}
      />
    </div>
  );
}

import { Calendar, Eye, Package, Plus, Receipt } from "lucide-react";
import { Button } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { formatQuantity } from "@workspace/core";
import { useProductStockEntries } from "@/features/stock-entries/hooks/useProductStockEntries";
import { StockEntryDetailsModal } from "@/features/stock-entries/components/StockEntryDetailsModal";
import { SimpleStockEntryModal } from "@/features/stock-entries/components/SimpleStockEntryModal";

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
}: ProductStockTabProps) {
  const stock = useProductStockEntries(productId);
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

          <Button
            type="button"
            onClick={stock.openNewEntry}
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
                      {entry.invoiceNumber || "-"}
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
        suppliers={stock.suppliers}
        form={stock.form}
        onChange={stock.updateForm}
        isSaving={stock.isSavingEntry}
        onSubmit={stock.handleSaveEntry}
      />
    </div>
  );
}

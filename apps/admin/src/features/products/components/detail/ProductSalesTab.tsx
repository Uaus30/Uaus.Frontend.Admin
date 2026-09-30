import { Calendar, Eye, ShoppingBag } from "lucide-react";
import { Badge, Button, Spinner, TablePagination } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { formatCurrency, formatDate, formatQuantity } from "@workspace/core";
import { PAYMENT_STATUS, enumCode } from "@workspace/api-client-react";
import { SaleDetailsModal } from "@/features/sales/components/SaleDetailsModal";
import { PRODUCT_SALES_PAGE_SIZE, useProductSales } from "../../hooks/useProductSales";
import type { StockTabProductOption } from "./ProductStockTab";

type ProductSalesTabProps = {
  /** A VARIAÇÃO, e não o grupo: é ela que sai na venda. `null` no cadastro ainda não salvo. */
  productId: number | null;
  /** Variações gravadas do grupo. Vazio em produto simples — o seletor não aparece. */
  variationOptions: StockTabProductOption[];
  onSelectProduct: (productId: number) => void;
};

/**
 * Aba **Vendas**: as saídas deste produto, uma linha por item de venda.
 *
 * Responde "quando saiu, quanto saiu e por quanto" — o que a aba Estoque
 * responde para as entradas. A linha é de propósito enxuta (data e hora,
 * quantidade, preço praticado); o resto da venda (cliente, pagamento, demais
 * itens) abre pelo olho, na mesma modal da tela de Vendas.
 *
 * A venda **cancelada** aparece marcada, e não escondida: o estoque dela
 * voltou, então ela não é saída — mas some da lista e alguém procura a venda
 * que "sumiu". Quem soma o que saiu desconta as marcadas.
 */
export function ProductSalesTab({ productId, variationOptions, onSelectProduct }: ProductSalesTabProps) {
  const sales = useProductSales(productId);

  if (productId === null) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-background/40 p-10 text-center">
        <ShoppingBag className="mx-auto mb-3 h-12 w-12 text-muted-foreground opacity-20" />
        <p className="text-sm font-medium text-foreground">Salve o produto para ver as vendas dele</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border/50 bg-background/40 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Vendas deste produto
          </h2>
          <p className="text-xs text-muted-foreground">
            Da mais recente para a mais antiga. O olho abre a venda inteira.
          </p>
        </div>

        {variationOptions.length > 0 && (
          <div className="space-y-1.5">
            <label
              htmlFor="select-variacao-vendas"
              className="block text-xs font-medium text-muted-foreground"
            >
              Variação selecionada:
            </label>
            <Select
              value={String(productId)}
              // Só id de verdade sobe: o Radix avisa com string vazia enquanto o
              // item do `value` ainda não montou (mesma regra da aba Estoque).
              onValueChange={(value) => {
                const id = Number(value);
                if (Number.isInteger(id) && id > 0) onSelectProduct(id);
              }}
            >
              <SelectTrigger id="select-variacao-vendas" className="h-9 w-full sm:w-[260px]">
                <SelectValue placeholder="Selecione a variação" />
              </SelectTrigger>
              <SelectContent>
                {variationOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {sales.isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Spinner />
        </div>
      ) : sales.isError ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Não foi possível carregar as vendas deste produto.
        </p>
      ) : sales.sales.length === 0 ? (
        <div className="py-10 text-center text-muted-foreground">
          <ShoppingBag className="mx-auto mb-3 h-12 w-12 opacity-20" />
          <p>Nenhuma venda deste produto.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/40">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="px-4 py-3">Data e hora</TableHead>
                <TableHead className="px-4 py-3 text-right">Quantidade</TableHead>
                <TableHead
                  className="px-4 py-3 text-right"
                  title="Preço praticado na venda, já com o desconto do item"
                >
                  Valor unitário
                </TableHead>
                <TableHead className="w-24 px-4 py-3 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.sales.map((sale) => {
                const cancelada = enumCode(sale.paymentStatus, PAYMENT_STATUS) === PAYMENT_STATUS.Cancelled;
                return (
                  <TableRow
                    key={sale.saleItemId}
                    className={`transition-colors hover:bg-muted/10 ${cancelada ? "text-muted-foreground" : ""}`}
                  >
                    <TableCell className="px-4 py-3 text-sm">
                      <span className="flex items-center gap-2">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatDate(sale.createdAt)}
                        <span className="text-xs text-muted-foreground">#{sale.saleId}</span>
                        {cancelada && (
                          <Badge variant="outline" className="font-normal">
                            Cancelada
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-sm font-semibold">
                      {formatQuantity(sale.quantity)}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right font-mono text-sm">
                      {formatCurrency(sale.unitPrice)}
                      {/* Preço de tabela riscado quando houve desconto no item — o
                          mesmo sinal da modal da venda. */}
                      {sale.discount > 0 && (
                        <p className="text-[11px] text-muted-foreground line-through">
                          {formatCurrency(sale.unitPrice + sale.discount)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Ver detalhes da venda ${sale.saleId}`}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={() => sales.openSale(sale.saleId)}
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

      {sales.total > PRODUCT_SALES_PAGE_SIZE && (
        <TablePagination
          page={sales.page}
          pageSize={PRODUCT_SALES_PAGE_SIZE}
          total={sales.total}
          onPageChange={sales.setPage}
          itemLabel={{ singular: "venda", plural: "vendas" }}
        />
      )}

      <SaleDetailsModal
        open={sales.viewSaleId !== null}
        onOpenChange={(open) => !open && sales.closeSale()}
        saleId={sales.viewSaleId}
      />
    </div>
  );
}

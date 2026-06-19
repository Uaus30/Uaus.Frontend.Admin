import React from "react";
import { Eye, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { EnrichedSale } from "../types";

type SalesTableProps = {
  /** True if list of transactions is loading */
  isLoading: boolean;
  /** Enriched sales dataset list */
  saleDetails: EnrichedSale[];
  /** Map of payment methods names */
  paymentMethodById: Record<number, string>;
  /** Current page index */
  page: number;
  /** Callback to update page index */
  setPage: React.Dispatch<React.SetStateAction<number>>;
  /** Paginated sale object from the API */
  salesPage: any;
  /** Callback to view specific sale detail by ID */
  onViewDetails: (id: number) => void;
  /** Callback to delete specific sale by ID */
  onDelete: (id: number) => void;
  /** Active sale ID being deleted, or null */
  deletingSaleId: number | null;
};

/**
 * SalesTable
 * 
 * Component rendering the grid table listing sales transactions and paging controls.
 */
export function SalesTable({
  isLoading,
  saleDetails,
  paymentMethodById,
  page,
  setPage,
  salesPage,
  onViewDetails,
  onDelete,
  deletingSaleId,
}: SalesTableProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-lg shadow-black/5">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Data</th>
              <th className="px-6 py-4">Cliente</th>
              <th className="px-6 py-4">Pagamento</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                </td>
              </tr>
            ) : saleDetails.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-muted-foreground">
                  Nenhuma venda registrada.
                </td>
              </tr>
            ) : (
              saleDetails.map((sale) => (
                <tr key={sale.id} className="border-b border-border/50 transition-colors hover:bg-muted/20">
                  <td className="px-6 py-4 font-mono font-medium text-muted-foreground">
                    #{sale.id.toString().padStart(4, "0")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{formatDate(sale.createdAt)}</td>
                  <td className="px-6 py-4 font-medium">
                    {sale.customer?.name || <span className="text-muted-foreground">Consumidor Final</span>}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className="border-border/50 font-normal">
                      {paymentMethodById[sale.paymentMethod] ?? sale.paymentMethod}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 font-medium text-primary">{formatCurrency(sale.total)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover-elevate"
                        onClick={() => onViewDetails(sale.id)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover-elevate"
                        onClick={() => {
                          if (confirm("Remover esta venda e seus itens?")) {
                            onDelete(sale.id);
                          }
                        }}
                      >
                        {deletingSaleId === sale.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-border/50 p-4 text-sm text-muted-foreground">
        <span>
          Mostrando página {salesPage?.page || 1} de{" "}
          {Math.ceil((salesPage?.total || 0) / (salesPage?.limit || 15)) || 1}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={salesPage ? salesPage.data.length < salesPage.limit : true}
            onClick={() => setPage((current) => current + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}

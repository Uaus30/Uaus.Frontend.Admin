import React from "react";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/formatters";
import type { CategoryReport } from "../types";

type CategoryReportModalProps = {
  /** Boolean state flag indicating whether the report dialog is open */
  isOpen: boolean;
  /** Setter callback to update visibility state of the report dialog */
  onOpenChange: (open: boolean) => void;
  /** Mock report analytical data object */
  selectedReport: CategoryReport | null;
};

/**
 * CategoryReportModal
 * 
 * Renders the modal sheet displaying the category's sales mock report dashboard.
 */
export function CategoryReportModal({
  isOpen,
  onOpenChange,
  selectedReport,
}: CategoryReportModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/50 bg-card sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-display">
            <BarChart3 className="h-5 w-5 text-primary" />
            Relatório: {selectedReport?.category.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {!selectedReport ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                Dados mockados: esta visualização é uma prévia até o endpoint de relatório ficar disponível.
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Faturamento Total",
                    value: formatCurrency(selectedReport.totalRevenue),
                    className: "text-primary",
                  },
                  { label: "Vendas (Qtd)", value: selectedReport.totalSales, className: "" },
                  { label: "Estoque Total", value: `${selectedReport.totalStock} un`, className: "" },
                ].map((card) => (
                  <div key={card.label} className="rounded-xl border border-border/50 bg-background/50 p-4">
                    <p className="mb-1 text-xs text-muted-foreground">{card.label}</p>
                    <p className={`text-xl font-bold ${card.className}`}>{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="overflow-hidden rounded-xl border border-border/50">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3">Preço</th>
                      <th className="px-4 py-3">Estoque</th>
                      <th className="px-4 py-3">Vendas</th>
                      <th className="px-4 py-3 text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedReport.products.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b border-border/50 last:border-0 hover:bg-muted/10"
                      >
                        <td className="px-4 py-3 font-medium">{product.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatCurrency(product.price)}
                        </td>
                        <td className="px-4 py-3">{product.stock} un</td>
                        <td className="px-4 py-3">{product.totalSales}</td>
                        <td className="px-4 py-3 text-right font-medium text-primary">
                          {formatCurrency(product.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

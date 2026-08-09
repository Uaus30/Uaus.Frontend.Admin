import React from "react";
import { BarChart3 } from "lucide-react";
import { Button } from "@workspace/ui";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import { CatalogReportBody } from "@/components/catalog-report-body";
import type { CategoryReport } from "../types";

type CategoryReportModalProps = {
  /** Boolean state flag indicating whether the report dialog is open */
  isOpen: boolean;
  /** Setter callback to update visibility state of the report dialog */
  onOpenChange: (open: boolean) => void;
  /** Relatório carregado da API, ou nulo enquanto a consulta não retorna */
  selectedReport: CategoryReport | null;
  /** Verdadeiro enquanto o relatório está sendo buscado */
  isLoading?: boolean;
};

/**
 * CategoryReportModal
 *
 * Exibe o desempenho de vendas dos produtos da categoria no período padrão do
 * relatório (últimos 30 dias).
 */
export function CategoryReportModal({
  isOpen,
  onOpenChange,
  selectedReport,
  isLoading = false,
}: CategoryReportModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/50 bg-card sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-5 w-5 text-primary" />
            Relatório: {selectedReport?.category.name ?? "categoria"}
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {isLoading || !selectedReport ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : (
            <CatalogReportBody report={selectedReport} emptyMessage="Esta categoria ainda não tem produtos cadastrados." />
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



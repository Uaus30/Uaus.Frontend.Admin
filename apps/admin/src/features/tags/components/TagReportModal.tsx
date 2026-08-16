import React from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { CatalogReportBody } from "@/components/catalog-report-body";
import type { TagReport } from "../types";

type TagReportModalProps = {
  /** Visibility state of the modal dialog */
  open: boolean;
  /** Callback to trigger visibility state change */
  onOpenChange: (open: boolean) => void;
  /** Relatório carregado da API, ou nulo enquanto a consulta não retorna */
  selectedReport: TagReport | null;
  /** Verdadeiro enquanto o relatório está sendo buscado */
  isLoading?: boolean;
};

/**
 * TagReportModal
 *
 * Exibe o desempenho de vendas dos produtos marcados com a etiqueta no período
 * padrão do relatório (últimos 30 dias).
 */
export function TagReportModal({
  open,
  onOpenChange,
  selectedReport,
  isLoading = false,
}: TagReportModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border/50 bg-card sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-5 w-5 text-primary" />
            Relatório:{" "}
            <span className="inline-flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selectedReport?.tag.color }}
                aria-hidden
              />
              {selectedReport?.tag.name ?? "etiqueta"}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-2">
          {isLoading || !selectedReport ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <CatalogReportBody
              report={selectedReport}
              emptyMessage="Nenhum produto ativo está marcado com esta etiqueta."
            />
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

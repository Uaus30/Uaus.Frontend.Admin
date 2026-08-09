import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteProductLabelBatch,
  getProductLabelBatchById,
  useGetProductLabelBatches,
  type ProductLabelBatchDto,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { printLabelSheet } from "../print";
import { labelTypeFromEnum, type PrintableLabel } from "../types";

/** Converte os itens congelados de um lote nas etiquetas de preview/impressão. */
export function batchToPrintableLabels(batch: ProductLabelBatchDto): PrintableLabel[] {
  return batch.items.map((item) => ({
    productName: item.productName,
    barcode: item.barcode,
    price: item.price,
    labelType: labelTypeFromEnum(item.labelType),
    quantity: item.quantity,
  }));
}

/**
 * Orquestra a aba de histórico: listagem paginada dos lotes, detalhes,
 * reimpressão fiel (usa os valores congelados na geração, não o cadastro
 * atual) e exclusão do registro.
 */
export function useLabelBatchHistory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProductLabelBatchDto | null>(null);
  const [reprintingId, setReprintingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: batchPage, isLoading } = useGetProductLabelBatches({ page, limit });
  const totalPages = batchPage?.totalPages ?? 1;

  const { data: detailsBatch, isLoading: isDetailsLoading } = useQuery({
    queryKey: ["ProductLabelBatch", detailsId ?? 0],
    queryFn: () => getProductLabelBatchById(detailsId as number),
    enabled: detailsId !== null,
  });

  /** Reimprime o lote como saiu no papel original. */
  const handleReprint = async (id: number) => {
    setReprintingId(id);
    try {
      const batch = await getProductLabelBatchById(id);
      if (batch.items.length === 0) {
        toast({ title: "Lote sem itens para reimprimir", variant: "destructive" });
        return;
      }

      await printLabelSheet(batchToPrintableLabels(batch));
    } catch (error) {
      console.error("Erro ao reimprimir lote de etiquetas:", error);
      toast({
        title: "Erro ao reimprimir lote",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
        error,
      });
    } finally {
      setReprintingId(null);
    }
  };

  /** Exclui o lote marcado em `deleteTarget` (confirmado no AlertDialog). */
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await deleteProductLabelBatch(deleteTarget.id);
      await queryClient.invalidateQueries({ queryKey: ["ProductLabelBatches"] });
      toast({ title: "Lote excluído do histórico!" });
      setDeleteTarget(null);
    } catch (error) {
      console.error("Erro ao excluir lote de etiquetas:", error);
      toast({
        title: "Erro ao excluir lote",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
        error,
      });
    } finally {
      setDeleting(false);
    }
  };

  return {
    page,
    setPage,
    limit,
    setLimit,
    batchPage,
    isLoading,
    totalPages,
    detailsId,
    setDetailsId,
    detailsBatch,
    isDetailsLoading,
    deleteTarget,
    setDeleteTarget,
    deleting,
    reprintingId,
    handleReprint,
    handleDelete,
  };
}

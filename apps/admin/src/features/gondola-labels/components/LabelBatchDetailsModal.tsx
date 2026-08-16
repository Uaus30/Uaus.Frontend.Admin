import { Printer } from "lucide-react";
import { Button } from "@workspace/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui";
import { Spinner } from "@workspace/ui";
import { formatDate } from "@workspace/core";
import type { ProductLabelBatchDto } from "@workspace/api-client-react";
import { batchToPrintableLabels } from "../hooks/useLabelBatchHistory";
import { LabelPreviewCard } from "./LabelPreviewCard";

interface LabelBatchDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: ProductLabelBatchDto | undefined;
  isLoading: boolean;
  reprinting: boolean;
  onReprint: (id: number) => void;
}

/**
 * Detalhes de um lote do histórico: as etiquetas exatamente como foram
 * impressas (valores congelados na geração), com reimpressão direta.
 */
export function LabelBatchDetailsModal({
  open,
  onOpenChange,
  batch,
  isLoading,
  reprinting,
  onReprint,
}: LabelBatchDetailsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Lote #{batch?.id ?? "—"}
            {batch?.description ? ` — ${batch.description}` : ""}
          </DialogTitle>
          <DialogDescription>
            {batch
              ? `Gerado em ${formatDate(batch.createdAt)}${batch.userName ? ` por ${batch.userName}` : ""} · ` +
                `${batch.totalProducts} produto(s) · ${batch.totalLabels} etiqueta(s)`
              : "Carregando lote..."}
          </DialogDescription>
        </DialogHeader>

        {isLoading || !batch ? (
          <div className="flex justify-center py-10">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <div className="grid max-h-[55vh] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            {batchToPrintableLabels(batch).map((label, index) => (
              <LabelPreviewCard key={index} label={label} />
            ))}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button type="button" disabled={!batch || reprinting} onClick={() => batch && onReprint(batch.id)}>
            {reprinting ? <Spinner className="mr-2 h-4 w-4" /> : <Printer className="mr-2 h-4 w-4" />}
            Reimprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

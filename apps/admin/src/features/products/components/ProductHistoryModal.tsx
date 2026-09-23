import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@workspace/ui";
import { Clock } from "lucide-react";
import { ProductHistoryTimeline } from "./ProductHistoryTimeline";

type ProductHistoryModalProps = {
  productGroupId: number | null;
  productGroupName: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * O histórico do grupo, pelo menu da linha na listagem. O conteúdo é o mesmo da
 * aba "Histórico" do detalhe do produto — ver `ProductHistoryTimeline`.
 */
export function ProductHistoryModal({
  productGroupId,
  productGroupName,
  isOpen,
  onOpenChange,
}: ProductHistoryModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] border-border/50 bg-card p-6 flex flex-col gap-6 shadow-2xl rounded-2xl">
        <DialogHeader className="pb-2 border-b border-border/40">
          <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2.5 text-foreground">
            <Clock className="h-6 w-6 text-primary animate-pulse" />
            Histórico do Produto
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Grupo de Produto: <span className="font-semibold text-foreground">{productGroupName}</span> (ID:{" "}
            {productGroupId})
          </DialogDescription>
        </DialogHeader>

        <ProductHistoryTimeline
          productGroupId={productGroupId}
          active={isOpen}
          scrollClassName="flex-1 pr-3 overflow-y-auto max-h-[50vh]"
        />
      </DialogContent>
    </Dialog>
  );
}

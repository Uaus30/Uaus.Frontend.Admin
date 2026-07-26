import { Loader2 } from "lucide-react";
import type { StockWriteOffDto } from "@workspace/api-client-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/formatters";

type ReverseStockWriteOffDialogProps = {
  /** Baixa alvo do estorno, ou `null` quando o diálogo está fechado. */
  writeOff: StockWriteOffDto | null;
  reason: string;
  onReasonChange: (reason: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  isReversing: boolean;
};

/**
 * ReverseStockWriteOffDialog
 *
 * Confirmação do estorno. O texto insiste que estornar devolve o estoque e
 * mantém o registro: baixa não se apaga, porque apagar deixaria o estoque
 * reduzido sem contrapartida no histórico.
 */
export function ReverseStockWriteOffDialog({
  writeOff,
  reason,
  onReasonChange,
  onCancel,
  onConfirm,
  isReversing,
}: ReverseStockWriteOffDialogProps) {
  const canConfirm = reason.trim().length > 0 && !isReversing;

  return (
    <AlertDialog open={writeOff != null} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Estornar a baixa #{writeOff?.id}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                O estorno <strong>devolve ao estoque</strong> tudo o que esta baixa retirou e
                <strong> mantém o registro no histórico</strong>, marcado como estornado. Não é
                exclusão: a baixa continua aparecendo na listagem.
              </p>
              {writeOff && (
                <p className="text-foreground">
                  {formatDate(writeOff.occurredAt)} · {formatQuantity(writeOff.totalQuantity)} de
                  quantidade · {formatCurrency(writeOff.totalCost)} de custo
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reversal-reason" className="text-sm font-medium">
            Motivo do estorno
          </Label>
          <Textarea
            id="reversal-reason"
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Por que esta baixa está sendo desfeita..."
            className="bg-background"
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isReversing}>Voltar</AlertDialogCancel>
          <AlertDialogAction
            disabled={!canConfirm}
            onClick={(event) => {
              // O Radix fecha o diálogo ao clicar na ação; segurar o fechamento
              // aqui deixa o spinner visível e evita perder o motivo digitado se
              // o backend recusar.
              event.preventDefault();
              onConfirm();
            }}
          >
            {isReversing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Estornar e devolver o estoque
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

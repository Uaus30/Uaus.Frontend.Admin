import { Ban, SlidersHorizontal } from "lucide-react";
import type { StockControlDisabledReason } from "@workspace/api-client-react";
import { STOCK_CONTROL_DISABLED_REASONS } from "@/lib/stock-control";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui";
import type { LowStockConfirm } from "../hooks/useLowStock";

/** O Radix não aceita item de valor vazio: "sem motivo" precisa de um valor próprio. */
const SEM_MOTIVO = "none";

type LowStockConfirmDialogProps = {
  confirm: LowStockConfirm | null;
  onCancel: () => void;
  onConfirm: () => void;
  /** Motivo escolhido ao desligar o controle. */
  onReasonChange: (reason: StockControlDisabledReason | null) => void;
  isSaving: boolean;
};

/**
 * A confirmação das duas ações do menu da linha.
 *
 * As duas mudam o cadastro do produto e não têm desfazer nesta tela — daí a
 * pergunta. O texto cita o PRODUTO e diz o que vai acontecer com ele: "tem
 * certeza?" sozinho obriga a lembrar em qual linha se clicou.
 *
 * Inativar usa âmbar, e não vermelho: vermelho aqui leria como exclusão, e
 * inativar é reversível — o produto continua no catálogo, com saldo e histórico,
 * e volta pela tela dele. (A escala de cor da retaguarda está no CLAUDE.md.)
 */
export function LowStockConfirmDialog({
  confirm,
  onCancel,
  onConfirm,
  onReasonChange,
  isSaving,
}: LowStockConfirmDialogProps) {
  const inativando = confirm?.action === "inactivate";
  const motivo = STOCK_CONTROL_DISABLED_REASONS.find((item) => item.value === confirm?.reason);

  return (
    <AlertDialog open={confirm !== null} onOpenChange={(aberto) => !aberto && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader className="items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10">
            {inativando ? (
              <Ban className="h-6 w-6 text-amber-600" />
            ) : (
              <SlidersHorizontal className="h-6 w-6 text-amber-600" />
            )}
          </div>
          <AlertDialogTitle>
            {inativando ? "Inativar o produto?" : "Desligar o controle de estoque?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {confirm === null ? null : inativando ? (
              <>
                <strong>{confirm.item.productName}</strong> sai deste relatório, do alerta e da venda — o PDV
                e a loja deixam de oferecê-lo. Ele continua no catálogo, com o saldo e o histórico que tem, e
                pode ser reativado na tela do produto.
              </>
            ) : (
              <>
                <strong>{confirm.item.productName}</strong> sai deste relatório e do alerta, mas continua à
                venda. Ele vai para a aba &quot;Fora do controle&quot;, de onde se religa, e a mudança fica no
                histórico do produto.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {confirm !== null && !inativando && (
          <div className="space-y-1.5">
            <label htmlFor="stock-control-reason" className="text-sm font-medium">
              Motivo <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <Select
              value={confirm.reason ?? SEM_MOTIVO}
              onValueChange={(value) =>
                onReasonChange(value === SEM_MOTIVO ? null : (value as StockControlDisabledReason))
              }
              disabled={isSaving}
            >
              <SelectTrigger id="stock-control-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SEM_MOTIVO}>Sem motivo</SelectItem>
                {STOCK_CONTROL_DISABLED_REASONS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {motivo && <p className="text-xs text-muted-foreground">{motivo.hint}</p>}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // Sem isto o Radix fecha o diálogo antes de a gravação terminar, e
              // o erro chegaria como toast sobre uma tela que já mudou.
              event.preventDefault();
              onConfirm();
            }}
            disabled={isSaving}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isSaving ? "Salvando..." : inativando ? "Inativar produto" : "Desligar controle"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

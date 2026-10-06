import React, { useState } from "react";
import { Ban, Loader2 } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
} from "@workspace/ui";
import { formatCurrency, formatDate } from "@workspace/core";
import type { SaleToCancel } from "../types";

/** Menos que isso não explica nada ("x", "ok"). */
const MIN_REASON_LENGTH = 3;

type CancelSaleDialogProps = {
  /** A venda a cancelar; nulo fecha o diálogo. */
  sale: SaleToCancel | null;
  cancelling: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
};

/**
 * Cancelar a venda, com motivo obrigatório (decisão do dono, 06/10/2026: "uma
 * venda registrada jamais pode ser excluída, sempre deverá no máximo ser
 * cancelada e com motivo informado").
 *
 * Substitui o "Remover venda", que apagava a venda do histórico. O texto diz o
 * que o cancelamento faz — a venda fica, marcada; o estoque volta; sai do
 * faturamento —, para ninguém cancelar achando que apaga.
 */
export function CancelSaleDialog({ sale, cancelling, onClose, onConfirm }: CancelSaleDialogProps) {
  return (
    <Dialog open={sale !== null} onOpenChange={(open) => !open && !cancelling && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        {/* `key`: outra venda começa com o motivo em branco. */}
        {sale && (
          <CancelSaleForm
            key={sale.id}
            sale={sale}
            cancelling={cancelling}
            onClose={onClose}
            onConfirm={onConfirm}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CancelSaleForm({
  sale,
  cancelling,
  onClose,
  onConfirm,
}: Omit<CancelSaleDialogProps, "sale"> & { sale: SaleToCancel }) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_REASON_LENGTH;
  const numero = `#${sale.id.toString().padStart(4, "0")}`;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) onConfirm(trimmed);
      }}
      className="space-y-4"
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-display text-xl">
          <Ban className="h-5 w-5 text-destructive" /> Cancelar a venda {numero}
        </DialogTitle>
        <DialogDescription>
          {formatDate(sale.createdAt)} — {formatCurrency(sale.total)}. A venda continua no histórico, marcada
          como cancelada: o estoque dos itens volta, ela sai do faturamento e do lucro, e cupom e carimbo de
          fidelidade, se houver, são estornados. Não dá para desfazer.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <label htmlFor="cancel-sale-reason" className="text-sm font-medium">
          Motivo do cancelamento
        </label>
        <Textarea
          id="cancel-sale-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Ex.: cliente desistiu, lançada em duplicidade, produto errado..."
          className="min-h-20 bg-background"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">Fica na observação da venda.</p>
      </div>

      <DialogFooter className="max-sm:[&>button]:flex-1">
        <Button type="button" variant="outline" onClick={onClose} disabled={cancelling}>
          Voltar
        </Button>
        <Button type="submit" variant="destructive" disabled={!valid || cancelling}>
          {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Cancelar venda
        </Button>
      </DialogFooter>
    </form>
  );
}

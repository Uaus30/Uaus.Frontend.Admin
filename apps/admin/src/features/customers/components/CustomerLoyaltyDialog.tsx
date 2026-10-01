import { useState } from "react";
import { Loader2, Printer, Stamp } from "lucide-react";
import type { LoyaltyStatementDto } from "@workspace/api-client-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  filledFieldClass,
} from "@workspace/ui";
import { describeLoyaltyStamp, formatShortDate } from "@workspace/core";
import { rewardLine, toStampLine } from "../lib/loyalty-statement";

type CustomerLoyaltyDialogProps = {
  customerName: string | null;
  statement?: LoyaltyStatementDto;
  isLoading: boolean;
  onClose: () => void;
  onPrint: () => void;
  onAdjust: (points: number, reason: string) => Promise<unknown>;
  isAdjusting: boolean;
};

/**
 * O cartão fidelidade do cliente no admin (entrega 5): o extrato — cada
 * carimbo com a data, e os prêmios —, a impressão e o ajuste manual. O ajuste
 * é para a venda esquecida ou o cartão de papel com mais carimbos que o
 * digital; o motivo é obrigatório e aparece no extrato.
 */
export function CustomerLoyaltyDialog({
  customerName,
  statement,
  isLoading,
  onClose,
  onPrint,
  onAdjust,
  isAdjusting,
}: CustomerLoyaltyDialogProps) {
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const card = statement?.card;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(points);
    if (!Number.isInteger(value) || value === 0 || Math.abs(value) > 10) {
      setError("Informe de 1 a 10 carimbos, com sinal de menos para tirar (ex.: -1).");
      return;
    }
    if (!reason.trim()) {
      setError("Informe o motivo: ele aparece no extrato.");
      return;
    }
    setError(null);
    try {
      await onAdjust(value, reason.trim());
      setPoints("");
      setReason("");
    } catch {
      // A frase do servidor já saiu no toast.
    }
  };

  // O diálogo fica montado entre um cliente e outro: o ajuste digitado para um
  // não pode aparecer pronto para gravar no próximo.
  const close = () => {
    setPoints("");
    setReason("");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={customerName !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border/50 bg-card sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <Stamp className="h-5 w-5 text-primary" /> {customerName}
          </DialogTitle>
          <DialogDescription>
            Cartão fidelidade
            {card
              ? ` · ${card.stamps} de ${card.stampsRequired} carimbos · válido até ${formatShortDate(card.expiresAt)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-3 text-sm">
            {statement && statement.stamps.length > 0 ? (
              <ul className="space-y-1">
                {statement.stamps.map((stamp, index) => (
                  <li key={index} className="font-mono text-xs">
                    {describeLoyaltyStamp(toStampLine(stamp))} · {formatShortDate(stamp.occurredAt)}
                    {stamp.reason ? ` — ${stamp.reason}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Nenhum carimbo ainda.</p>
            )}
            {statement?.rewards.map((reward) => (
              <p key={reward.id} className="text-muted-foreground">
                {rewardLine(reward, card?.middleStamp, card?.stampsRequired)}
              </p>
            ))}
            <Button variant="outline" size="sm" className="gap-2" onClick={onPrint} disabled={!statement}>
              <Printer className="h-4 w-4" /> Imprimir extrato
            </Button>
          </div>
        )}

        <form onSubmit={submit} className="space-y-3 border-t border-border/60 pt-4" noValidate>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ajuste manual
          </p>
          <p className="text-xs text-muted-foreground">
            Venda lançada no cliente errado? Reedite a venda: o carimbo muda de cliente sozinho.
          </p>
          <div className="grid grid-cols-[6rem_1fr] gap-3">
            <Input
              aria-label="Carimbos"
              inputMode="numeric"
              placeholder="+1 ou -1"
              value={points}
              onChange={(event) => setPoints(event.target.value.replace(/[^\d-]/g, ""))}
              className={filledFieldClass(points.trim().length > 0)}
            />
            <Input
              aria-label="Motivo do ajuste"
              placeholder="Motivo (ex.: venda de 12/11 sem cliente identificado)"
              maxLength={200}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className={filledFieldClass(reason.trim().length > 0)}
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button type="submit" disabled={isAdjusting}>
              {isAdjusting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gravar ajuste"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

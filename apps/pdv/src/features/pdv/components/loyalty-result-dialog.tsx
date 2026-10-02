import { Gift, Printer, ScrollText, Stamp } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, cn } from "@workspace/ui";
import { cardSlots, formatShortDate, ordinal, stampsToNextReward } from "@workspace/core";
import { describeLoyaltyPrize, useLoyaltyStore } from "../hooks/use-loyalty";
import { useReceiptPrinter } from "../hooks/use-receipt-printer";

/**
 * O cartão digital depois da venda com cliente (01/10/2026): as casas do
 * trecho atual com o carimbo novo, o que falta para o próximo prêmio e o
 * lembrete de carimbar o cartão de papel — que é espelho do digital.
 *
 * Daqui o operador também imprime o comprovante com o saldo (quando o cliente
 * pede) e abre o extrato.
 */
export function LoyaltyResultDialog({ onClosed }: { onClosed?: () => void }) {
  const result = useLoyaltyStore((state) => state.lastResult);
  const setLastResult = useLoyaltyStore((state) => state.setLastResult);
  const showStatement = useLoyaltyStore((state) => state.showStatement);
  const { sendReceiptToPrinter } = useReceiptPrinter();

  const outcome = result?.outcome;
  const card = outcome?.card;
  const close = () => setLastResult(null);

  const printWithBalance = () => {
    if (!result || !card) return;
    void sendReceiptToPrinter({
      ...result.receipt,
      loyalty: {
        stamped: outcome!.stamped,
        reason: outcome!.reason,
        stamps: card.stamps,
        stampsRequired: card.stampsRequired,
        toNextReward: stampsToNextReward(card.stamps, card.nextRewardAt),
        nextRewardLabel: describeLoyaltyPrize(card.nextRewardType, card.nextRewardValue),
        expiresAt: card.expiresAt,
        cardCompleted: outcome!.cardCompleted,
      },
    });
  };

  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent
        className="border-border bg-card p-6 shadow-2xl sm:max-w-[480px]"
        // O diálogo abre sozinho depois da venda; ao fechar, o cursor volta
        // para a busca, senão o primeiro bipe da próxima venda se perde.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed?.();
        }}
      >
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
          <Stamp className="h-5 w-5 text-primary" /> {result?.customerName}
        </DialogTitle>
        <DialogDescription className="text-xs">
          Cartão fidelidade{card ? ` · válido até ${formatShortDate(card.expiresAt)}` : ""}
        </DialogDescription>

        {card && (
          // Até 5 casas por linha, como o cartão de papel: o cartão de 10 sem trecho
          // (sem prêmio do meio, ou com ele já liberado) vira duas fileiras em vez
          // de dez casas espremidas em elipse.
          <div className="mx-auto flex max-w-[18rem] flex-wrap justify-center gap-2 py-2">
            {cardSlots(card.stamps, card.stampsRequired, card.middleStamp, card.nextRewardAt).map((slot) => (
              <div
                key={slot.number}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 text-sm font-bold",
                  slot.filled
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-dashed border-border text-muted-foreground",
                  slot.number === outcome?.stampNumber && "ring-4 ring-amber-400/60",
                )}
              >
                {slot.prize && !slot.filled ? <Gift className="h-5 w-5" /> : slot.number}
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 text-sm">
          {outcome?.stamped ? (
            <p>
              Esta compra ganhou 1 carimbo.
              {card &&
                (stampsToNextReward(card.stamps, card.nextRewardAt) > 0
                  ? ` ${card.stamps} de ${card.stampsRequired} · faltam ${stampsToNextReward(card.stamps, card.nextRewardAt)} para o próximo prêmio de ${describeLoyaltyPrize(card.nextRewardType, card.nextRewardValue)}.`
                  : "")}
            </p>
          ) : (
            <p className="text-muted-foreground">Esta compra não ganhou carimbo: {outcome?.reason}</p>
          )}

          {outcome?.unlockedRewards.map((reward) => (
            <p
              key={reward.id}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-semibold"
            >
              Prêmio de {describeLoyaltyPrize(reward.discountType, reward.discountValue)} liberado: entra
              sozinho na próxima compra, até {formatShortDate(reward.redeemUntil)}.
            </p>
          ))}

          {outcome?.cardCompleted ? (
            <p className="rounded-lg border border-amber-500/50 bg-amber-400/15 px-3 py-2 font-semibold">
              Cartão completo! Recolha o de papel e entregue um novo com {card?.stamps ?? 0} carimbo(s).
            </p>
          ) : (
            outcome?.stamped &&
            outcome.stampNumber && (
              <p className="rounded-lg border border-amber-500/50 bg-amber-400/15 px-3 py-2 font-semibold">
                Carimbe o cartão de papel do cliente: {ordinal(outcome.stampNumber)} carimbo.
              </p>
            )
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="outline" className="gap-2" onClick={printWithBalance} disabled={!card}>
            <Printer className="h-4 w-4" /> Comprovante com saldo
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => {
              if (!result) return;
              close();
              showStatement(result.customerId);
            }}
          >
            <ScrollText className="h-4 w-4" /> Extrato
          </Button>
          <Button autoFocus onClick={close}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

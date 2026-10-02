import { Printer, ScrollText, Stamp } from "lucide-react";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui";
import { formatShortDate, ordinal, stampsToNextReward } from "@workspace/core";
import { describeLoyaltyPrize, useLoyaltyStore } from "../hooks/use-loyalty";
import { useReceiptPrinter } from "../hooks/use-receipt-printer";
import { describeLoyaltyResult } from "../lib/loyalty-result";
import { LoyaltyCardSlots } from "./loyalty-card-slots";

/**
 * O cartão digital depois da venda com cliente (01/10/2026): as casas do
 * trecho atual com o que esta compra rendeu em destaque, o que falta para o
 * próximo prêmio e o lembrete de carimbar o cartão de papel — que é espelho do
 * digital.
 *
 * Com ele na tela a venda não imprime sozinha (pedido do dono, 01/10/2026): o
 * comprovante sai daqui, com ou sem o saldo do cartão, e o extrato também.
 */
/**
 * A frase da compra que completa o cartão: o último carimbo dele e o extra do
 * novo. Sem extra configurado (o admin aceita zero), é um carimbo só.
 */
const completedLine = (earned: number, closedAt: number) => {
  const extra = earned - 1;
  const last = `o ${ordinal(closedAt)}, que completou o cartão`;
  if (extra <= 0) return `Esta compra ganhou 1 carimbo: ${last}.`;
  return `Esta compra ganhou ${earned} carimbos: ${last}, e ${extra === 1 ? "o 1º do cartão novo (extra)" : `${extra} no cartão novo (extra)`}.`;
};

export function LoyaltyResultDialog({ onClosed }: { onClosed?: () => void }) {
  const result = useLoyaltyStore((state) => state.lastResult);
  const setLastResult = useLoyaltyStore((state) => state.setLastResult);
  const showStatement = useLoyaltyStore((state) => state.showStatement);
  const { sendReceiptToPrinter } = useReceiptPrinter();

  const outcome = result?.outcome;
  const card = outcome?.card;
  const close = () => setLastResult(null);
  const { rows, earnedCount } = outcome ? describeLoyaltyResult(outcome) : { rows: [], earnedCount: 0 };

  const printReceipt = () => {
    if (result) void sendReceiptToPrinter(result.receipt);
  };

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

  const toNext = card ? stampsToNextReward(card.stamps, card.nextRewardAt) : 0;

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
        <div className="space-y-0.5 text-center">
          <DialogTitle className="flex items-center justify-center gap-2 text-xl font-bold">
            <Stamp className="h-5 w-5 text-primary" aria-hidden /> Programa de Fidelidade
          </DialogTitle>
          <p className="text-base font-semibold">{result?.customerName}</p>
          <DialogDescription className="text-xs">
            {card ? `Cartão válido até ${formatShortDate(card.expiresAt)}` : "Cartão fidelidade"}
          </DialogDescription>
        </div>

        {rows.length > 0 && (
          <div className="space-y-3 py-2">
            {rows.map((row) => (
              <LoyaltyCardSlots
                key={row.label ?? "cartao"}
                slots={row.slots}
                earnedNow={row.earnedNow}
                label={row.label}
              />
            ))}
          </div>
        )}

        <div className="space-y-2 text-sm">
          {outcome?.stamped ? (
            <p>
              {outcome.cardCompleted
                ? completedLine(earnedCount, outcome.stampNumber ?? card?.stampsRequired ?? 0)
                : "Esta compra ganhou 1 carimbo."}
              {card &&
                toNext > 0 &&
                ` ${card.stamps} de ${card.stampsRequired} · faltam ${toNext} para o próximo prêmio de ${describeLoyaltyPrize(card.nextRewardType, card.nextRewardValue)}.`}
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
          <Button variant="outline" className="gap-2" onClick={printReceipt} disabled={!result}>
            <Printer className="h-4 w-4" /> Comprovante
          </Button>
          <Button variant="outline" className="gap-2" onClick={printWithBalance} disabled={!card}>
            <Printer className="h-4 w-4" /> Com saldo do cartão
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

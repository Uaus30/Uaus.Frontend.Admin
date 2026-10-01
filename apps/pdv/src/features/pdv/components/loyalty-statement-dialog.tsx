import { Loader2, Printer, ScrollText } from "lucide-react";
import { LOYALTY_STAMP_KIND, enumCode, useGetLoyaltyStatement } from "@workspace/api-client-react";
import { printLoyaltyStatement, resolveStoreInfo } from "@workspace/receipt";
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui";
import { formatShortDate } from "@workspace/core";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { useLoyaltyStore } from "../hooks/use-loyalty";
import { describeReward } from "../lib/loyalty-text";

/**
 * O extrato do cartão (a segunda via): cada carimbo com a data, e os prêmios.
 * Resolve o cartão de papel perdido ou esquecido: o operador carimba um novo
 * conferindo por aqui, ou imprime na impressora do caixa.
 */
export function LoyaltyStatementDialog() {
  const customerId = useLoyaltyStore((state) => state.statementCustomerId);
  const showStatement = useLoyaltyStore((state) => state.showStatement);
  const { settings } = useCompanySettings();
  const { data, isLoading, isError } = useGetLoyaltyStatement(customerId, {
    query: { staleTime: 0, retry: false },
  });

  const card = data?.card;
  const rewardLines = (data?.rewards ?? []).map((reward) =>
    describeReward(reward, card?.middleStamp, card?.stampsRequired),
  );

  const print = () => {
    if (!data) return;
    void printLoyaltyStatement({
      customerName: data.customerName,
      stamps: data.stamps.map((stamp) => ({
        position: stamp.position,
        occurredAt: stamp.occurredAt,
        bonus: enumCode(stamp.kind, LOYALTY_STAMP_KIND) === LOYALTY_STAMP_KIND.Bonus,
      })),
      stampsRequired: card?.stampsRequired ?? 0,
      expiresAt: card?.expiresAt,
      rewardLines,
      printedAt: new Date(),
      store: resolveStoreInfo(settings),
    });
  };

  return (
    <Dialog open={customerId !== null} onOpenChange={(open) => !open && showStatement(null)}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-border bg-card p-6 shadow-2xl sm:max-w-[440px]">
        <DialogTitle className="flex items-center gap-2 text-xl font-bold">
          <ScrollText className="h-5 w-5 text-primary" /> Extrato do cartão
        </DialogTitle>
        <DialogDescription className="text-xs">
          {data
            ? `${data.customerName}${card ? ` · válido até ${formatShortDate(card.expiresAt)}` : ""}`
            : "A via oficial é a digital."}
        </DialogDescription>

        {isLoading && <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />}
        {isError && (
          <p className="text-sm text-destructive">Não foi possível ler o extrato. Confira a internet.</p>
        )}

        {data && (
          <div className="space-y-3 text-sm">
            {data.stamps.length === 0 ? (
              <p className="text-muted-foreground">Nenhum carimbo ainda.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
                {data.stamps.map((stamp) => (
                  <li key={`${stamp.position}-${stamp.occurredAt}`}>
                    {stamp.position}º {formatShortDate(stamp.occurredAt)}
                    {enumCode(stamp.kind, LOYALTY_STAMP_KIND) === LOYALTY_STAMP_KIND.Bonus ? " (extra)" : ""}
                  </li>
                ))}
              </ul>
            )}
            {card && (
              <p className="font-semibold">
                {card.stamps} de {card.stampsRequired} carimbos
              </p>
            )}
            {rewardLines.map((line) => (
              <p key={line} className="text-muted-foreground">
                {line}
              </p>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="gap-2" onClick={print} disabled={!data}>
            <Printer className="h-4 w-4" /> Imprimir extrato
          </Button>
          <Button onClick={() => showStatement(null)}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

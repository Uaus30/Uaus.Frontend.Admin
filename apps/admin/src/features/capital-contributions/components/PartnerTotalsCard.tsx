import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { CapitalContributionPartnerTotalDto } from "../types";

interface PartnerTotalsCardProps {
  totals: CapitalContributionPartnerTotalDto[];
  isLoading: boolean;
}

/**
 * Quanto cada sócio já aportou desde a abertura.
 *
 * Informativo: aporte não é dívida da loja com o sócio (decisão 9), então não
 * há saldo devedor, devolução nem juros — é só a soma do que entrou.
 */
export function PartnerTotalsCard({ totals, isLoading }: PartnerTotalsCardProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">Acumulado por sócio</CardTitle>
        <CardDescription>Desde a abertura. Informativo: aporte não é dívida da loja.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-16 rounded-md" />
        ) : totals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum aporte lançado ainda.</p>
        ) : (
          <ul className="divide-y divide-border/50 text-sm">
            {totals.map((partner) => (
              <li key={partner.partnerId} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">
                  {partner.partnerName}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({partner.count} {partner.count === 1 ? "aporte" : "aportes"})
                  </span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(partner.total)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

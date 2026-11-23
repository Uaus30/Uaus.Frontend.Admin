import { Link } from "wouter";
import { HandCoins, Plus } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { newCapitalContributionPath } from "@/features/capital-contributions/capital-contributions-route";
import type { CapitalContributionPartnerTotalDto, CapitalContributionsMonthDto } from "../types";

interface ContributionsCardProps {
  contributions?: CapitalContributionsMonthDto;
  isLoading: boolean;
  partnerTotals: CapitalContributionPartnerTotalDto[];
}

/** "2026-11-23T00:00:00" → "23/11", pelos dígitos (sem `Date`, sem fuso). */
function dayMonth(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/**
 * ContributionsCard
 *
 * Os aportes do mês e o acumulado de cada sócio desde a abertura, com o atalho
 * "Lançar aporte". O acumulado é informativo: aporte não é dívida da loja com
 * o sócio (decisão 9), então não há saldo devedor nem devolução para mostrar.
 */
export function ContributionsCard({ contributions, isLoading, partnerTotals }: ContributionsCardProps) {
  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <HandCoins className="h-5 w-5 text-primary" aria-hidden />
          Aportes
        </CardTitle>
        {contributions?.isClosed ? (
          <span className="text-xs text-muted-foreground">Mês fechado</span>
        ) : (
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link href={newCapitalContributionPath()}>
              <Plus className="h-4 w-4" />
              Lançar aporte
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {isLoading ? (
          <Skeleton className="h-16 rounded-md" />
        ) : !contributions ? (
          <p className="text-sm text-destructive">Não foi possível carregar os aportes do mês.</p>
        ) : contributions.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum aporte neste mês.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {contributions.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="tabular-nums text-muted-foreground">
                    {dayMonth(item.contributionDate)}
                  </span>{" "}
                  {item.partnerName}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(item.amount)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 border-t border-border/50 pt-1.5 font-semibold">
              <span>Total do mês</span>
              <span className="tabular-nums">{formatCurrency(contributions.total)}</span>
            </li>
          </ul>
        )}

        {partnerTotals.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Acumulado por sócio
            </p>
            <ul className="space-y-1 text-sm">
              {partnerTotals.map((partner) => (
                <li key={partner.partnerId} className="flex items-center justify-between gap-3">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}

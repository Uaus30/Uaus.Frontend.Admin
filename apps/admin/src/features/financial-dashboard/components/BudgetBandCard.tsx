import { Link } from "wouter";
import { AlertTriangle, ArrowRight, CircleDashed, Lock } from "lucide-react";
import { Button, Card, CardContent, Skeleton, cn } from "@workspace/ui";
import { describeApiError, monthNameOf, purchaseBandFor } from "@workspace/core";
import {
  PURCHASE_BAND_LOOK,
  balanceSupport,
  monthInSentence,
  plannedNotice,
  provisionalNotice,
  purchaseBandHeadline,
  purchaseBandOf,
  purchaseRooms,
} from "@/lib/purchase-band";
import { FINANCIAL_CLOSINGS_PATH } from "@/features/financial-closings/financial-closings-route";
import type { PurchaseBudgetDto } from "../types";

interface BudgetBandCardProps {
  budget?: PurchaseBudgetDto;
  isLoading: boolean;
  /** Erro da consulta da faixa; nulo quando ela respondeu. */
  error: unknown;
}

/**
 * BudgetBandCard
 *
 * A faixa de compras do mês, no topo do Painel: cor, ícone e a frase (seção
 * 7.1 do plano), o quanto ainda dá para comprar e, fora do verde, o aporte que
 * traz o mês de volta. Provisória, diz qual mês falta fechar e leva até lá —
 * fechamento atrasado deixa a faixa provisória por mais dias, e o botão é o
 * empurrão para fechar cedo.
 *
 * A faixa vem do servidor; se por algum motivo ela não vier, sai das duas
 * linhas pela mesma regra do core (`purchaseBandFor`), em vez de a tela ficar
 * sem cor.
 */
export function BudgetBandCard({ budget, isLoading, error }: BudgetBandCardProps) {
  if (isLoading) return <Skeleton className="h-44 rounded-xl" />;

  if (!budget) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex items-start gap-2 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Não foi possível calcular a faixa de compras. {error ? describeApiError(error) : ""}</span>
        </CardContent>
      </Card>
    );
  }

  const band =
    purchaseBandOf(budget.band) ?? purchaseBandFor(budget.purchasesPaid, budget.greenLimit, budget.redLimit);
  const look = PURCHASE_BAND_LOOK[band];
  const Icon = look.icon;
  const { parts, backToGreen } = purchaseRooms(band, budget.greenRoom, budget.redRoom);
  const planned = plannedNotice(budget);

  return (
    <Card className={cn("border", look.panelClass)} data-testid="budget-band-card" data-band={band}>
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Icon className={cn("mt-0.5 h-8 w-8 shrink-0", look.textClass)} aria-hidden />
          <div className="min-w-0 space-y-1">
            <p className={cn("text-xl font-display font-bold", look.textClass)}>
              {monthNameOf(budget.month)} está {look.name}
              {budget.isProvisional && (
                <span className="ml-2 align-middle text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  provisória
                </span>
              )}
            </p>
            <p className="text-sm text-foreground">{purchaseBandHeadline(band, balanceSupport(budget))}</p>
          </div>
        </div>

        {(parts.length > 0 || backToGreen) && (
          <div className="space-y-1 text-sm">
            {parts.length > 0 && (
              <p className="font-medium text-foreground">Pode comprar {parts.join(" · ")}</p>
            )}
            {backToGreen && <p className="font-medium text-foreground">{backToGreen}</p>}
          </div>
        )}

        {planned && <p className="text-sm text-muted-foreground">{planned}.</p>}
        {budget.plannedWithoutValueCount > 0 && (
          <p className="text-xs text-muted-foreground">
            {budget.plannedWithoutValueCount === 1
              ? "1 compra pendente sem valor fica fora da conta."
              : `${budget.plannedWithoutValueCount} compras pendentes sem valor ficam fora da conta.`}
          </p>
        )}

        {budget.isProvisional && (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-start gap-2">
              <CircleDashed className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Faixa provisória, sem o saldo inicial. {provisionalNotice(budget)}.</span>
            </span>
            <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
              <Link href={FINANCIAL_CLOSINGS_PATH}>
                Fechar {monthInSentence(budget.pendingClosingMonth) || "o mês anterior"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        )}

        {budget.isClosedMonth && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5 shrink-0" />
            Mês fechado: a faixa é a do fim do mês, com as compras lançadas até hoje.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

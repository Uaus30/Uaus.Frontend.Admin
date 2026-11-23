import { Link } from "wouter";
import { ChevronRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { PURCHASES_PATH } from "@/features/purchases/purchases-route";
import { CAPITAL_CONTRIBUTIONS_PATH } from "@/features/capital-contributions/capital-contributions-route";
import { FINANCIAL_CLOSINGS_PATH } from "@/features/financial-closings/financial-closings-route";
import type { FinancialReportSummaryDto, PurchaseBudgetDto } from "../types";

interface MonthNumbersCardProps {
  budget?: PurchaseBudgetDto;
  summary?: FinancialReportSummaryDto;
  isLoadingSummary: boolean;
}

interface NumberRowProps {
  label: string;
  /** Valor já formatado, ou `null` enquanto carrega. */
  value: string | null;
  /** A linha de apoio embaixo (as parcelas dos descontos, as planejadas). */
  hint?: string | null;
  /** A tela de origem do número. */
  href: string;
}

/** Uma linha que leva à tela de onde o número vem. */
function NumberRow({ label, value, hint, href }: NumberRowProps) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/40"
      >
        <span className="min-w-0">
          <span className="block text-sm text-foreground">{label}</span>
          {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {value === null ? (
            <Skeleton className="h-4 w-20" />
          ) : (
            <span className="text-sm font-semibold tabular-nums text-foreground">{value}</span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </span>
      </Link>
    </li>
  );
}

/**
 * MonthNumbersCard
 *
 * "O mês em números" (seção 7.1): saldo inicial, aportes, vendas brutas,
 * descontos por origem, vendas líquidas, custo das vendas, compras pagas (com
 * as planejadas ao lado), custos fixos, baixas e sobras. Cada linha leva à
 * tela de origem do número — é o caminho para conferir em vez de acreditar.
 *
 * Promoção e cupom aparecem como PARCELAS dos descontos, nunca somadas a eles:
 * a promoção já está dentro do desconto no item, e o cupom, dentro do desconto
 * na venda.
 */
export function MonthNumbersCard({ budget, summary, isLoadingSummary }: MonthNumbersCardProps) {
  const money = (value: number | undefined) => (value == null ? null : formatCurrency(value));
  const fromSummary = (value: number | undefined) => (isLoadingSummary || !summary ? null : money(value));

  const discountsHint = summary
    ? `no item ${formatCurrency(summary.itemDiscountsTotal)} (promoção ${formatCurrency(summary.promotionDiscountsTotal)}) · na venda ${formatCurrency(summary.discountsTotal - summary.itemDiscountsTotal)} (cupom ${formatCurrency(summary.couponDiscountsTotal)})`
    : null;
  const plannedHint =
    budget && budget.purchasesPlanned > 0
      ? `${formatCurrency(budget.purchasesPlanned)} planejadas (pendentes)`
      : null;
  const openingHint = budget?.isProvisional ? "Fora da conta até o mês anterior ser fechado" : null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold">O mês em números</CardTitle>
        <CardDescription>Toque num número para abrir a tela de onde ele vem.</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="divide-y divide-border/50">
          <NumberRow
            label="Saldo inicial"
            value={money(budget?.openingBalance)}
            hint={openingHint}
            href={FINANCIAL_CLOSINGS_PATH}
          />
          <NumberRow label="Aportes" value={money(budget?.contributions)} href={CAPITAL_CONTRIBUTIONS_PATH} />
          <NumberRow label="Vendas brutas" value={fromSummary(summary?.grossSales)} href="/vendas" />
          <NumberRow
            label="Descontos concedidos"
            value={fromSummary(summary?.discountsTotal)}
            hint={discountsHint}
            href="/vendas"
          />
          <NumberRow label="Vendas líquidas" value={money(budget?.revenue)} href="/vendas" />
          <NumberRow
            label="Custo das vendas"
            value={money(budget?.costOfSales)}
            href="/financeiro/relatorios"
          />
          <NumberRow
            label="Compras pagas"
            value={money(budget?.purchasesPaid)}
            hint={plannedHint}
            href={PURCHASES_PATH}
          />
          <NumberRow label="Custos fixos" value={money(budget?.fixedCosts)} href="/financeiro/custos-fixos" />
          <NumberRow
            label="Baixas a custo"
            value={fromSummary(summary?.writeOffs.totalCost)}
            href="/estoque/baixas"
          />
          <NumberRow
            label="Sobras de estoque"
            value={fromSummary(summary?.stockSurplusTotal)}
            hint="Entradas de ajuste manual — somam no lucro"
            href="/financeiro/relatorios"
          />
        </ul>
      </CardContent>
    </Card>
  );
}

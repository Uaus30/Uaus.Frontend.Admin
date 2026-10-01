import type { LucideIcon } from "lucide-react";
import { BadgePercent, Gift, Repeat, Stamp, Users, Wallet } from "lucide-react";
import type { LoyaltySummaryDto } from "@workspace/api-client-react";
import { Card, CardContent, Skeleton } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { useCountUp } from "../hooks/useCountUp";

type KpiCardProps = {
  icon: LucideIcon;
  label: string;
  value: number;
  format: (value: number) => string;
  /** A linha de baixo: a comparação ou o contexto do número. */
  hint: string;
};

function KpiCard({ icon: Icon, label, value, format, hint }: KpiCardProps) {
  const shown = useCountUp(value);
  return (
    <Card className="border-border/50 bg-card/60 backdrop-blur-sm transition-shadow hover:shadow-md">
      <CardContent className="space-y-2 p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="font-display text-3xl font-bold tabular-nums">{format(shown)}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

const integer = (value: number) => Math.round(value).toLocaleString("pt-BR");
const percent = (value: number) => `${Math.round(value * 100)}%`;
const decimal = (value: number) =>
  value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Os seis números do período (01/10/2026), cada um respondendo a um objetivo
 * do dono: o cliente voltar, saber quem ele é e vender mais por compra.
 */
export function LoyaltyKpiCards({ summary, isLoading }: { summary?: LoyaltySummaryDto; isLoading: boolean }) {
  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  const ticketChange =
    summary.baselineAverageTicket > 0
      ? (summary.averageTicket / summary.baselineAverageTicket - 1) * 100
      : null;
  const stampsPerParticipant = summary.participants > 0 ? summary.stampsGiven / summary.participants : 0;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <KpiCard
        icon={Users}
        label="Clientes participantes"
        value={summary.participants}
        format={integer}
        hint={`${summary.newParticipants} estrearam no período · ${summary.customersRegistered} cadastros (${summary.customersRegisteredAtPdv} no caixa)`}
      />
      <KpiCard
        icon={BadgePercent}
        label="Vendas com cliente"
        value={summary.identifiedShare}
        format={percent}
        hint={`${summary.salesWithCustomer} de ${summary.sales} vendas · meta de dezembro: 30%`}
      />
      <KpiCard
        icon={Stamp}
        label="Carimbos dados"
        value={summary.stampsGiven}
        format={integer}
        hint={`${decimal(stampsPerParticipant)} por participante`}
      />
      <KpiCard
        icon={Gift}
        label="Prêmios trocados"
        value={summary.rewardsRedeemed}
        format={integer}
        hint={`${formatCurrency(summary.rewardsDiscount)} em desconto · ${summary.rewardsUnlocked} liberados`}
      />
      <KpiCard
        icon={Wallet}
        label="Valor médio da loja"
        value={summary.averageTicket}
        format={formatCurrency}
        hint={`jun–set: ${formatCurrency(summary.baselineAverageTicket)}${
          ticketChange === null ? "" : ` · ${ticketChange >= 0 ? "+" : ""}${Math.round(ticketChange)}%`
        }`}
      />
      <KpiCard
        icon={Repeat}
        label="Visitas por cliente/mês"
        value={summary.visitsPerCustomerPerMonth}
        format={decimal}
        hint="Compras dos clientes identificados, por mês"
      />
    </div>
  );
}

import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@workspace/ui";
import { AlertTriangle, Handshake, ReceiptText } from "lucide-react";
import { formatCurrency, formatPercentage } from "@workspace/core";
import type { ClosingNumbers, FinancialReportFixedCostItemDto } from "../types";

interface ClosingSummaryProps {
  /** Números do fechamento (persistido) ou da prévia — o formato é o mesmo. */
  closing: ClosingNumbers;
  /** Detalhamento dos custos fixos por competência — disponível apenas na prévia. */
  fixedCostItems?: FinancialReportFixedCostItemDto[];
  /** Avisos do servidor (período parcial de mês, soma de percentuais ≠ 100...). */
  warnings?: string[];
}

interface KpiCardProps {
  label: string;
  value: string;
  /** Complemento pequeno abaixo do valor (ex.: "informativo"). */
  hint?: string;
  /** Destaca o card e pinta o valor de verde/vermelho conforme o sinal. */
  highlight?: boolean;
  negative?: boolean;
}

/** Mini-card de indicador usado dentro dos diálogos. */
function KpiCard({ label, value, hint, highlight, negative }: KpiCardProps) {
  const valueColor = highlight
    ? negative
      ? "text-destructive"
      : "text-emerald-600"
    : "text-foreground";

  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight ? "border-primary/40 bg-primary/5" : "bg-muted/20"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-lg font-bold ${valueColor}`}>{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * ClosingSummary
 *
 * Resumo financeiro compartilhado entre a prévia do novo fechamento e o
 * detalhe de um fechamento existente: cards de indicadores, custos fixos por
 * competência (só na prévia), rateio por sócio e avisos do servidor.
 */
export function ClosingSummary({ closing, fixedCostItems, warnings }: ClosingSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Avisos do servidor (período parcial, distribuição não configurada...) */}
      {warnings && warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
          {warnings.map((warning) => (
            <p
              key={warning}
              className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{warning}</span>
            </p>
          ))}
        </div>
      )}

      {/* Indicadores do período */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Faturamento" value={formatCurrency(closing.revenue)} />
        <KpiCard label="Descontos" value={formatCurrency(closing.discounts)} />
        <KpiCard label="CMV" value={formatCurrency(closing.cogsCost)} />
        <KpiCard label="Lucro Bruto" value={formatCurrency(closing.grossProfit)} />
        <KpiCard label="Custos Fixos" value={formatCurrency(closing.fixedCostsTotal)} />
        <KpiCard
          label="Lucro Líquido"
          value={formatCurrency(closing.netProfit)}
          highlight
          negative={closing.netProfit < 0}
        />
        <KpiCard
          label="Compras no período"
          value={formatCurrency(closing.purchasesTotal)}
          hint="Informativo — não entra no lucro líquido"
        />
        <KpiCard
          label="Perdas no período"
          value={formatCurrency(closing.writeOffLossesTotal)}
          hint="Informativo — o CMV já cobre o custo das vendas"
        />
        <KpiCard label="Vendas" value={String(closing.salesCount)} />
      </div>

      {/* Custos fixos por competência (apenas na prévia) */}
      {fixedCostItems && fixedCostItems.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ReceiptText className="h-4 w-4 text-primary" />
            Custos fixos do período
          </p>
          <div className="rounded-md border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Nome</TableHead>
                  <TableHead className="text-right">Valor mensal</TableHead>
                  <TableHead className="text-right">Meses</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixedCostItems.map((item) => (
                  <TableRow key={item.fixedCostId}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.monthlyAmount)}
                    </TableCell>
                    <TableCell className="text-right">{item.monthsCount}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Rateio por sócio */}
      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Handshake className="h-4 w-4 text-primary" />
          Rateio entre os sócios
        </p>
        {closing.shares.length === 0 ? (
          <p className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
            Nenhum rateio calculado — configure a distribuição de lucros dos sócios.
          </p>
        ) : (
          <div className="rounded-md border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Sócio</TableHead>
                  <TableHead className="text-right">Percentual</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closing.shares.map((share) => (
                  <TableRow key={share.partnerId}>
                    <TableCell className="font-medium">{share.partnerName}</TableCell>
                    <TableCell className="text-right">
                      {formatPercentage(share.percentage)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        share.amount < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {formatCurrency(share.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}



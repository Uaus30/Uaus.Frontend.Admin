import { Link } from "wouter";
import { History } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui";
import { formatCurrency, formatMonthKey, monthKeyRange } from "@workspace/core";
import { PurchaseBandBadge } from "@/components/purchase-band-badge";
import { purchaseBandOf } from "@/lib/purchase-band";
import { FINANCIAL_CLOSINGS_PATH } from "@/features/financial-closings/financial-closings-route";
import type { FinancialClosingDto } from "../types";

interface ClosingsHistoryCardProps {
  closings: FinancialClosingDto[];
  isLoading: boolean;
}

/** "2026-07-15T00:00:00" → "15/07/2026", pelos dígitos (sem `Date`, sem fuso). */
function brDate(value: string): string {
  return `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
}

/**
 * O mês por extenso quando o fechamento cobre o mês cheio; o intervalo de datas
 * nos antigos de período livre (15/07 a 10/08) — chamar esses de "Julho" esconderia
 * justamente o que eles têm de diferente.
 */
function periodLabel(closing: FinancialClosingDto): string {
  const range = monthKeyRange(closing.periodStart);
  const fullMonth =
    range != null &&
    closing.periodStart.slice(0, 10) === range.start &&
    closing.periodEnd.slice(0, 10) === range.end;
  return fullMonth
    ? formatMonthKey(closing.periodStart)
    : `${brDate(closing.periodStart)} — ${brDate(closing.periodEnd)}`;
}

/** Fechamento da conta antiga (versão 1, ou sem versão — API anterior à conta nova). */
function isLegacy(closing: FinancialClosingDto): boolean {
  return (closing.calculationVersion ?? 1) < 2;
}

/** Campo que só existe na conta nova: "—" nos fechamentos antigos, em vez do zero. */
function newField(closing: FinancialClosingDto, value: number | null | undefined): string {
  if (isLegacy(closing) || value == null) return "—";
  return formatCurrency(value);
}

/** Esconde a coluna abaixo do `lg`: tabela larga em tela pequena perde coluna, nunca rola. */
const WIDE = "hidden lg:table-cell";

/**
 * ClosingsHistoryCard
 *
 * Os meses fechados, um por linha: vendas líquidas, descontos, compras pagas,
 * baixas, lucro líquido, retiradas, saldo final e a faixa do fim do mês.
 *
 * Os fechamentos antigos (`calculationVersion` 1, de março a outubro/2026) não
 * são recalculados e não tinham descontos por origem, compras pagas, retiradas
 * nem saldo: mostram "—" ali, e não um zero que pareceria dado. No celular
 * ficam a competência, o lucro, o saldo e a faixa — o resto está a um toque, na
 * tela de Fechamentos.
 */
export function ClosingsHistoryCard({ closings, isLoading }: ClosingsHistoryCardProps) {
  const hasLegacy = closings.some(isLegacy);

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <History className="h-5 w-5 text-primary" aria-hidden />
            Meses fechados
          </CardTitle>
          <CardDescription>O documento de cada mês, congelado na confirmação.</CardDescription>
        </div>
        <Link
          href={FINANCIAL_CLOSINGS_PATH}
          className="shrink-0 text-sm font-medium text-primary hover:underline"
        >
          Ver fechamentos
        </Link>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-32 rounded-md" />
        ) : closings.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum mês fechado ainda.</p>
        ) : (
          <div className="overflow-hidden rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Mês</TableHead>
                  <TableHead className={`${WIDE} text-right`}>Vendas líquidas</TableHead>
                  <TableHead className={`${WIDE} text-right`}>Descontos</TableHead>
                  <TableHead className={`${WIDE} text-right`}>Compras pagas</TableHead>
                  <TableHead className={`${WIDE} text-right`}>Baixas</TableHead>
                  <TableHead className="text-right">Lucro líquido</TableHead>
                  <TableHead className={`${WIDE} text-right`}>Retiradas</TableHead>
                  <TableHead className="text-right">Saldo final</TableHead>
                  <TableHead>Faixa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {closings.map((closing) => {
                  const band = isLegacy(closing) ? null : purchaseBandOf(closing.purchaseBand);
                  return (
                    <TableRow key={closing.id}>
                      <TableCell className="font-medium">{periodLabel(closing)}</TableCell>
                      <TableCell className={`${WIDE} text-right tabular-nums`}>
                        {formatCurrency(closing.revenue)}
                      </TableCell>
                      <TableCell className={`${WIDE} text-right tabular-nums`}>
                        {newField(closing, closing.discountsTotal)}
                      </TableCell>
                      <TableCell className={`${WIDE} text-right tabular-nums`}>
                        {newField(closing, closing.purchasesPaidTotal)}
                      </TableCell>
                      <TableCell className={`${WIDE} text-right tabular-nums`}>
                        {formatCurrency(closing.writeOffLossesTotal)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${
                          closing.netProfit < 0
                            ? "text-destructive"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {formatCurrency(closing.netProfit)}
                      </TableCell>
                      <TableCell className={`${WIDE} text-right tabular-nums`}>
                        {newField(closing, closing.withdrawalsTotal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {newField(closing, closing.closingBalance)}
                      </TableCell>
                      <TableCell>
                        {band ? <PurchaseBandBadge band={band} className="text-xs" /> : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {hasLegacy && (
          <p className="mt-2 text-xs text-muted-foreground">
            "—": mês fechado com a conta antiga — baixas fora do lucro e só o desconto da venda.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

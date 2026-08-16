import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@workspace/ui";
import { Lock } from "lucide-react";
import { formatCurrency, formatDate, formatShortDate } from "@workspace/core";
import type { FinancialClosingDto } from "../types";

interface FinancialClosingsTableProps {
  items: FinancialClosingDto[];
  isLoading: boolean;
  /** Abre o detalhe do fechamento clicado. */
  onRowClick: (id: number) => void;
}

/**
 * FinancialClosingsTable
 *
 * Tabela dos fechamentos financeiros confirmados. Cada linha abre o detalhe
 * com o rateio congelado — não há edição: fechamento se refaz excluindo.
 */
export function FinancialClosingsTable({ items, isLoading, onRowClick }: FinancialClosingsTableProps) {
  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Carregando fechamentos...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card">
        <Lock className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="font-medium text-base">Nenhum fechamento registrado</p>
        <p className="text-sm">Clique em "Novo Fechamento" para congelar os números de um período.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Período</TableHead>
            <TableHead className="text-right">Faturamento</TableHead>
            <TableHead className="text-right">Lucro Bruto</TableHead>
            <TableHead className="text-right">Custos Fixos</TableHead>
            <TableHead className="text-right">Lucro Líquido</TableHead>
            <TableHead>Fechado por</TableHead>
            <TableHead>Em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              onClick={() => onRowClick(item.id)}
              className="cursor-pointer hover:bg-muted/30 transition-colors"
            >
              <TableCell className="font-semibold text-foreground">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    {formatShortDate(item.periodStart)} — {formatShortDate(item.periodEnd)}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right">{formatCurrency(item.revenue)}</TableCell>
              <TableCell className="text-right">{formatCurrency(item.grossProfit)}</TableCell>
              <TableCell className="text-right">{formatCurrency(item.fixedCostsTotal)}</TableCell>
              <TableCell
                className={`text-right font-semibold ${
                  item.netProfit < 0 ? "text-destructive" : "text-emerald-600"
                }`}
              >
                {formatCurrency(item.netProfit)}
              </TableCell>
              <TableCell>{item.closedByUserName ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(item.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

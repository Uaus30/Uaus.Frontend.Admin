import { ReceiptText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { FinancialReportFixedCostItemDto } from "../types";

interface FixedCostItemsTableProps {
  items: FinancialReportFixedCostItemDto[];
}

/**
 * Os custos fixos considerados na prévia, por competência: cada mês tocado lança
 * o valor mensal cheio, sem pró-rata. Só a prévia traz o detalhamento; o
 * documento confirmado guarda o total.
 */
export function FixedCostItemsTable({ items }: FixedCostItemsTableProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <ReceiptText className="h-4 w-4 text-primary" />
        Custos fixos do mês
      </p>
      <div className="overflow-hidden rounded-md border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Nome</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Valor mensal</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Meses</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.fixedCostId}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="hidden text-right sm:table-cell">
                  {formatCurrency(item.monthlyAmount)}
                </TableCell>
                <TableCell className="hidden text-right sm:table-cell">{item.monthsCount}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(item.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { ReceiptText } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/formatters";
import type { FinancialReportFixedCostsDto } from "../types";

type FixedCostsCardProps = {
  fixedCosts: FinancialReportFixedCostsDto;
};

/**
 * FixedCostsCard
 *
 * Detalhamento dos custos fixos considerados no período: cada mês-calendário
 * tocado lança o valor mensal cheio do custo vigente naquele mês (competência
 * mensal, sem pró-rata).
 */
export function FixedCostsCard({ fixedCosts }: FixedCostsCardProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Custos fixos do período</CardTitle>
        <CardDescription>
          Competência mensal: cada mês tocado pelo período lança o valor mensal cheio, sem
          pró-rata.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {fixedCosts.items.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <ReceiptText className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">Nenhum custo fixo vigente no período</p>
            <p className="text-sm">Cadastre os custos fixos para compor o lucro líquido.</p>
          </div>
        ) : (
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
                {fixedCosts.items.map((item) => (
                  <TableRow key={item.fixedCostId} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.monthlyAmount)}</TableCell>
                    <TableCell className="text-right">{item.monthsCount}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.total)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/20">
                  <TableCell colSpan={3} className="font-semibold">
                    Total no período
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(fixedCosts.total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

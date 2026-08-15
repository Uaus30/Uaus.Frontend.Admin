import { PackageX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui";
import { formatCurrency, formatQuantity } from "@workspace/core";
import type { FinancialReportWriteOffsDto } from "../types";

type WriteOffsByReasonCardProps = {
  writeOffs: FinancialReportWriteOffsDto;
};

/**
 * WriteOffsByReasonCard
 *
 * Perdas do período agrupadas por motivo (baixas de estoque confirmadas).
 * INFORMATIVAS: o CMV já cobre o custo FIFO dos itens vendidos, então a perda
 * não entra no lucro líquido.
 */
export function WriteOffsByReasonCard({ writeOffs }: WriteOffsByReasonCardProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Perdas por motivo</CardTitle>
        <CardDescription>
          Baixas de estoque confirmadas no período — informativas, não entram no lucro líquido.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {writeOffs.byReason.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <PackageX className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">Nenhuma perda registrada no período</p>
            <p className="text-sm">Baixas de estoque confirmadas aparecem aqui por motivo.</p>
          </div>
        ) : (
          <div className="rounded-md border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Motivo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {writeOffs.byReason.map((item) => (
                  <TableRow key={String(item.reason)} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{item.reasonName}</TableCell>
                    <TableCell className="text-right">{formatQuantity(item.totalQuantity)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.totalCost)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/20">
                  <TableCell className="font-semibold">Total no período</TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatQuantity(writeOffs.totalQuantity)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(writeOffs.totalCost)}
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



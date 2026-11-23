import { Handshake } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui";
import { formatCurrency, formatPercentage } from "@workspace/core";
import { isLegacyClosing, newFieldText } from "../closing-statement";
import type { ClosingNumbers } from "../types";

interface ClosingSharesBlockProps {
  closing: ClosingNumbers;
}

/**
 * ClosingSharesBlock
 *
 * O rateio congelado — o que o lucro dava a cada sócio — ao lado do que cada
 * um retirou. Retirar menos deixou o dinheiro na loja; retirar mais foi aceito,
 * com aviso (decisão F). Lucro negativo distribui prejuízo, em vermelho.
 */
export function ClosingSharesBlock({ closing }: ClosingSharesBlockProps) {
  const legacy = isLegacyClosing(closing);

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Handshake className="h-4 w-4 text-primary" aria-hidden />
        Rateio e retiradas
      </h3>
      {closing.shares.length === 0 ? (
        <p className="rounded-md border bg-card p-3 text-sm text-muted-foreground">
          Nenhum rateio calculado — configure a distribuição de lucros dos sócios.
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead>Sócio</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Percentual</TableHead>
                <TableHead className="text-right">A distribuir</TableHead>
                <TableHead className="text-right">Retirado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closing.shares.map((share) => (
                <TableRow key={share.partnerId}>
                  <TableCell className="font-medium">{share.partnerName}</TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    {formatPercentage(share.percentage)}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums ${share.amount < 0 ? "text-destructive" : ""}`}
                  >
                    {formatCurrency(share.amount)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {newFieldText(legacy, share.withdrawnAmount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}

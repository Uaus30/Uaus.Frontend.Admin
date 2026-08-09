import { Handshake } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui";
import { formatCurrency, formatPercentage } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { PartnerDistributionItemDto } from "../types";

type PartnerDistributionCardProps = {
  /** Sócios ativos com os percentuais atuais; vazio quando não configurado. */
  distribution: PartnerDistributionItemDto[];
  /** Lucro líquido do período — negativo distribui prejuízo entre os sócios. */
  netProfit: number;
  className?: string;
};

/**
 * PartnerDistributionCard
 *
 * Distribuição PREVISTA do lucro líquido, calculada com os percentuais atuais
 * dos sócios ativos. O rateio oficial só é congelado na confirmação do
 * fechamento — mudar percentuais depois não retroage.
 */
export function PartnerDistributionCard({
  distribution,
  netProfit,
  className,
}: PartnerDistributionCardProps) {
  return (
    <Card className={cn("border-border/50", className)}>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Distribuição prevista por sócio</CardTitle>
        <CardDescription>
          Prévia com os percentuais atuais dos sócios ativos — o rateio oficial é congelado no
          fechamento do período.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {distribution.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <Handshake className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">Distribuição de lucros não configurada</p>
            <p className="text-sm">
              Defina os percentuais dos sócios ativos na tela de Sócios (a soma deve ser 100%).
            </p>
          </div>
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
                {distribution.map((item) => (
                  <TableRow key={item.partnerId} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{item.partnerName}</TableCell>
                    <TableCell className="text-right">{formatPercentage(item.percentage)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        item.amount < 0 && "text-destructive",
                      )}
                    >
                      {formatCurrency(item.amount)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/20">
                  <TableCell colSpan={2} className="font-semibold">
                    Lucro líquido do período
                  </TableCell>
                  <TableCell
                    className={cn("text-right font-bold", netProfit < 0 && "text-destructive")}
                  >
                    {formatCurrency(netProfit)}
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



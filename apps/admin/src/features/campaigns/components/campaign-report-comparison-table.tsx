import { BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui";
import { formatCurrency, formatDate, formatPercentage } from "@workspace/core";
import type { CampaignComparisonRowDto } from "@workspace/api-client-react";

type CampaignReportComparisonTableProps = {
  rows: CampaignComparisonRowDto[];
  /** Alguma campanha foi escolhida — muda a mensagem do estado vazio. */
  hasSelection: boolean;
};

/**
 * CampaignReportComparisonTable
 *
 * Os números do comparativo, uma linha por campanha — as mesmas colunas do CSV.
 *
 * A janela medida aparece como coluna, e não como nota de rodapé, porque é ela
 * que torna a linha reproduzível: quando o comparativo é filtrado por período, a
 * janela de cada campanha é a INTERSEÇÃO dela com o filtro, e duas campanhas da
 * mesma tabela podem ter sido medidas em intervalos de tamanhos diferentes.
 * Faturamento sem a janela ao lado é um número que ninguém consegue conferir.
 */
export function CampaignReportComparisonTable({
  rows,
  hasSelection,
}: CampaignReportComparisonTableProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Números do comparativo</CardTitle>
        <CardDescription>
          Cada linha é medida na janela dela, contra o faturamento da loja no mesmo intervalo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <BarChart3 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">
              {hasSelection
                ? "Nenhuma campanha com movimento na janela selecionada"
                : "Nenhuma campanha selecionada"}
            </p>
            <p className="text-sm">
              {hasSelection
                ? "O recorte de período só encolhe a janela de cada campanha — um filtro fora do ar dela zera a linha."
                : "Marque as campanhas na lista acima para montar o comparativo."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Campanha</TableHead>
                  <TableHead>Janela medida</TableHead>
                  <TableHead className="text-right">Resgates</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Ticket médio</TableHead>
                  <TableHead className="text-right">Custo em cupons</TableHead>
                  <TableHead className="text-right">% do faturamento</TableHead>
                  <TableHead className="text-right">% do lucro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.campaignId} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-medium">
                      {row.campaignName}
                      {row.reversed > 0 && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">
                          {row.reversed} estorno(s)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatDate(row.windowStart)} → {formatDate(row.windowEnd)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.redemptions}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.profit)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.averageTicket)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {formatCurrency(row.couponDiscount)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatPercentage(row.revenuePercentage)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatPercentage(row.profitPercentage)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

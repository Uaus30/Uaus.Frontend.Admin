import { TicketX } from "lucide-react";
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
import { formatCurrency } from "@workspace/core";
import type { CampaignReportCouponDto } from "@workspace/api-client-react";

type CampaignReportCouponsTableProps = {
  coupons: CampaignReportCouponDto[];
};

/**
 * CampaignReportCouponsTable
 *
 * Desempenho de cada cupom da campanha, do que mais faturou para o que menos
 * faturou.
 *
 * O código exibido é o SNAPSHOT gravado no resgate — o que estava impresso no
 * panfleto do cliente —, e não o cadastro atual. Ele continua legível mesmo se o
 * cupom tiver sido excluído do cadastro depois, que é justamente quando alguém
 * abre o relatório para entender o que aconteceu.
 *
 * O custo aparece ao lado do faturamento porque é a única forma de ler os dois
 * juntos: um cupom que faturou muito abatendo muito pode ter dado menos
 * resultado que outro modesto, e a tabela é onde essa comparação cabe.
 */
export function CampaignReportCouponsTable({ coupons }: CampaignReportCouponsTableProps) {
  const totalRedemptions = coupons.reduce((soma, cupom) => soma + cupom.redemptions, 0);
  const totalRevenue = coupons.reduce((soma, cupom) => soma + cupom.revenue, 0);
  const totalDiscount = coupons.reduce((soma, cupom) => soma + cupom.couponDiscount, 0);

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Cupons da campanha</CardTitle>
        <CardDescription>
          Um por cupom com resgate no intervalo. O código é o que estava impresso no panfleto.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {coupons.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <TicketX className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">Nenhum cupom resgatado no intervalo</p>
            <p className="text-sm">Os cupons ligados à campanha aparecem aqui no primeiro uso.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Cupom</TableHead>
                  <TableHead className="text-right">Resgates</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Custo em desconto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => (
                  <TableRow key={coupon.couponId} className="transition-colors hover:bg-muted/30">
                    <TableCell className="font-mono font-medium">{coupon.code}</TableCell>
                    <TableCell className="text-right tabular-nums">{coupon.redemptions}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(coupon.revenue)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-destructive">
                      {formatCurrency(coupon.couponDiscount)}
                    </TableCell>
                  </TableRow>
                ))}

                {/* Só vale a pena somar quando há mais de uma linha; com uma, o
                    total repetiria a própria linha acima. */}
                {coupons.length > 1 && (
                  <TableRow className="bg-muted/20">
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {totalRedemptions}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatCurrency(totalRevenue)}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-destructive">
                      {formatCurrency(totalDiscount)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

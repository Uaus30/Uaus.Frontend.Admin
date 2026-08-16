import { Badge, Button } from "@workspace/ui";
import { Ticket, Plus } from "lucide-react";
import { formatCurrency, formatShortDate } from "@workspace/core";
import { COUPON_DISCOUNT_TYPE, enumCode } from "@workspace/api-client-react";
import type { CouponDto } from "../types";

interface CampaignCouponsCardProps {
  /** Cupons cuja `campaignId` aponta para a campanha em edição. */
  coupons: CouponDto[];
  /** Total no servidor — pode ser maior que o que cabe na primeira página. */
  total: number;
  isLoading: boolean;
  /** Abre o cadastro de cupom já vinculado a esta campanha. */
  onCreateCoupon: () => void;
}

/** "10%" ou "R$ 20,00", conforme o tipo do cupom. */
function formatDiscount(coupon: CouponDto): string {
  const type = enumCode(coupon.discountType, COUPON_DISCOUNT_TYPE);
  if (type === COUPON_DISCOUNT_TYPE.Percentage) return `${coupon.discountValue}%`;
  return formatCurrency(coupon.discountValue);
}

/** "até 30/09/2026" ou "sem prazo" — `validUntil` ausente significa ilimitado no tempo. */
function formatValidity(coupon: CouponDto): string {
  return coupon.validUntil == null ? "sem prazo" : `até ${formatShortDate(coupon.validUntil)}`;
}

/**
 * CampaignCouponsCard
 *
 * Os cupons ligados à campanha, e o atalho para criar mais um já vinculado.
 *
 * A lista existe porque campanha sem cupom não chega ao caixa: o PDV encontra o
 * questionário pelo CÓDIGO DO CUPOM, e nunca pela campanha. Uma campanha
 * cadastrada com questionário caprichado e nenhum cupom apontando para ela
 * simplesmente não acontece — e, sem esta lista, o administrador só descobre
 * isso quando o relatório vem zerado.
 *
 * O que a lista NÃO diz é quanto cada cupom desconta por decisão da campanha:
 * quem decide dinheiro é a vigência e o valor do próprio cupom. A campanha só
 * decide se as perguntas aparecem.
 */
export function CampaignCouponsCard({ coupons, total, isLoading, onCreateCoupon }: CampaignCouponsCardProps) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Cupons vinculados</span>
          <Badge variant="secondary" className="font-mono">
            {total}
          </Badge>
        </div>

        <Button type="button" variant="outline" size="sm" className="gap-1" onClick={onCreateCoupon}>
          <Plus className="h-4 w-4" /> Cupom nesta campanha
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando cupons...</p>}

      {!isLoading && coupons.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nenhum cupom aponta para esta campanha ainda — sem cupom, o questionário nunca chega ao caixa.
        </p>
      )}

      {!isLoading &&
        coupons.map((coupon) => (
          <div
            key={coupon.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">{coupon.code}</span>
                <Badge variant={coupon.isActive ? "default" : "secondary"} className="text-[10px]">
                  {coupon.isActive ? "Ativo" : "Inativo"}
                </Badge>
              </div>
              {coupon.description && (
                <p className="truncate text-xs text-muted-foreground">{coupon.description}</p>
              )}
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="font-mono text-foreground">{formatDiscount(coupon)}</span>
              <span>{formatValidity(coupon)}</span>
              {/* Ausente = ILIMITADO. Exibir 0 aqui diria "esgotado" justamente
                  no cupom que nunca esgota. */}
              <span>
                {coupon.remainingUses == null ? "usos ilimitados" : `${coupon.remainingUses} usos restantes`}
              </span>
            </div>
          </div>
        ))}

      {!isLoading && total > coupons.length && (
        <p className="text-xs text-muted-foreground">
          Mostrando {coupons.length} de {total}. Os demais estão na tela de Cupons.
        </p>
      )}
    </div>
  );
}

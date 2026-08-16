import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui";
import {
  COUPON_DISCOUNT_TYPE,
  COUPON_DISCOUNT_TYPE_LABEL,
  enumCode,
} from "@workspace/api-client-react";
import { formatCurrency, formatDate } from "@workspace/core";
import { Edit2, Megaphone, PowerOff, TicketPercent, Trash2 } from "lucide-react";
import { canDeleteCoupon } from "../hooks/useCoupons";
import type { CouponDto } from "../types";

/**
 * Teto de resgates como texto.
 *
 * **`usageLimit <= 0` é ILIMITADO, nunca "0 usos".** É a mesma convenção do
 * banco e do UPDATE atômico que consome o cupom; escrever "0" aqui faria a tela
 * anunciar como esgotado justamente o cupom que nunca esgota.
 */
function formatUsageLimit(usageLimit: number): string {
  return usageLimit > 0 ? String(usageLimit) : "Ilimitado";
}

/** Desconto no formato que o panfleto promete: "10%" ou "R$ 20,00". */
function formatDiscount(coupon: CouponDto): string {
  const type = enumCode(coupon.discountType, COUPON_DISCOUNT_TYPE);
  if (type === COUPON_DISCOUNT_TYPE.Percentage) {
    return `${coupon.discountValue.toLocaleString("pt-BR")}%`;
  }
  return formatCurrency(coupon.discountValue);
}

/**
 * A vigência já passou?
 *
 * Vigência e indicador de ativo são colunas separadas: o cupom vencido continua
 * ATIVO no cadastro, e é assim que o administrador o encontra na listagem para
 * desativar. Quem recusa o desconto no balcão é a data, não o indicador.
 */
function isCouponExpired(coupon: CouponDto): boolean {
  return coupon.validUntil != null && new Date(coupon.validUntil).getTime() < Date.now();
}

interface CouponsTableProps {
  items: CouponDto[];
  isLoading: boolean;
  /** True enquanto uma exclusão/desativação está em voo — bloqueia o segundo clique. */
  isBusy: boolean;
  onEdit: (coupon: CouponDto) => void;
  /** Excluir ou desativar: quem decide qual dos dois é o hook, pelos resgates. */
  onDelete: (coupon: CouponDto) => void;
}

/**
 * Tabela dos cupons.
 *
 * A ação destrutiva muda de natureza conforme o histórico: **sem resgate,
 * "Excluir"; com resgate, "Desativar"**. O backend recusa o DELETE de um cupom
 * usado, mas oferecer o botão e devolver erro deixaria o operador sem saber qual
 * é o caminho certo.
 */
export function CouponsTable({ items, isLoading, isBusy, onEdit, onDelete }: CouponsTableProps) {
  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Carregando cupons...</div>;
  }

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground border rounded-lg bg-card">
        <TicketPercent className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="font-medium text-base">Nenhum cupom encontrado</p>
        <p className="text-sm">
          Cadastre o código do panfleto, o desconto e a vigência para o balcão poder aplicá-lo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Código</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Vigência</TableHead>
            <TableHead>Usos / Limite</TableHead>
            <TableHead>Ativo</TableHead>
            <TableHead>Campanha</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const expired = isCouponExpired(item);
            const podeExcluir = canDeleteCoupon(item);

            return (
              <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-semibold text-foreground">
                  <div className="flex items-center gap-2">
                    <TicketPercent className="w-4 h-4 text-primary shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-mono">{item.code}</span>
                      {item.description && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </div>
                </TableCell>

                <TableCell className="text-muted-foreground">
                  {COUPON_DISCOUNT_TYPE_LABEL[enumCode(item.discountType, COUPON_DISCOUNT_TYPE)] ??
                    "—"}
                </TableCell>

                <TableCell className="font-mono">{formatDiscount(item)}</TableCell>

                <TableCell
                  className={expired ? "text-destructive text-sm" : "text-muted-foreground text-sm"}
                >
                  {formatDate(item.validFrom)} —{" "}
                  {item.validUntil ? formatDate(item.validUntil) : "sem prazo"}
                  {expired && <span className="ml-1 font-medium">(vencido)</span>}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-mono">
                      {item.redeemedCount} / {formatUsageLimit(item.usageLimit)}
                    </span>
                    {item.remainingUses != null && (
                      <span
                        className="text-xs text-muted-foreground"
                        title="Leitura do instante, não reserva: o balcão offline pode consumir usos que ainda não apareceram aqui."
                      >
                        {item.remainingUses} restantes
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell>
                  {item.isActive ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                      Ativo
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="font-medium">
                      Inativo
                    </Badge>
                  )}
                </TableCell>

                <TableCell className="text-muted-foreground text-sm">
                  {item.campaignName ? (
                    <span className="inline-flex items-center gap-1">
                      <Megaphone className="w-3.5 h-3.5 shrink-0" />
                      {item.campaignName}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(item)}
                      title="Editar cupom"
                      className="h-8 w-8"
                    >
                      <Edit2 className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                    </Button>

                    {podeExcluir ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(item)}
                        disabled={isBusy}
                        title="Excluir cupom"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    ) : (
                      item.isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(item)}
                          disabled={isBusy}
                          title="Desativar cupom (já tem resgate e por isso não pode ser excluído)"
                          className="h-8 w-8"
                        >
                          <PowerOff className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                      )
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

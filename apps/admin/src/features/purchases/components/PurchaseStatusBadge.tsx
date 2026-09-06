import { Badge } from "@workspace/ui";
import { PURCHASE_STATUS, enumCode, type EnumValue } from "@workspace/api-client-react";

/**
 * Cor e rótulo de cada situação, como o dono pediu: Pendente vermelho, A
 * caminho azul, Lançado verde. Fora daqui não há cor de status escrita em
 * lugar nenhum da feature.
 */
const STATUS_STYLES: Record<number, { label: string; className: string }> = {
  [PURCHASE_STATUS.Pending]: {
    label: "Pendente",
    className: "border-transparent bg-red-600 text-white hover:bg-red-600",
  },
  [PURCHASE_STATUS.InTransit]: {
    label: "A caminho",
    className: "border-transparent bg-blue-600 text-white hover:bg-blue-600",
  },
  [PURCHASE_STATUS.Received]: {
    label: "Lançado",
    className: "border-transparent bg-emerald-600 text-white hover:bg-emerald-600",
  },
};

/** Selo da situação da compra. */
export function PurchaseStatusBadge({ status }: { status: EnumValue }) {
  const style = STATUS_STYLES[enumCode(status, PURCHASE_STATUS)];
  if (!style) return <Badge variant="outline">—</Badge>;

  return (
    <Badge variant="outline" className={style.className}>
      {style.label}
    </Badge>
  );
}

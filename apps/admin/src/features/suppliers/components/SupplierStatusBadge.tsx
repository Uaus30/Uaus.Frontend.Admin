import { Badge } from "@workspace/ui";
import { SUPPLIER_STATUS, enumCode, type EnumValue } from "@workspace/api-client-react";

/**
 * Cor e rótulo de cada status, no vocabulário de cores do sistema
 * (`Uaus.Docs/dominio/convencoes-de-interface.md`): Ativo verde, Inativo
 * vermelho. Até 15/10/2026 o selo era verde para qualquer status, e o
 * fornecedor inativo só se distinguia lendo o texto.
 */
const STATUS_STYLES: Record<number, { label: string; className: string }> = {
  [SUPPLIER_STATUS.Active]: {
    label: "Ativo",
    className: "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  [SUPPLIER_STATUS.Inactive]: {
    label: "Inativo",
    className: "border-transparent bg-red-500/15 text-red-700 dark:text-red-300",
  },
};

interface SupplierStatusBadgeProps {
  /** Status como a API manda: pelo NOME (`"Inactive"`), ou pelo código. */
  status: EnumValue;
  /** Rótulos do catálogo `/Suppliers/enums/supplier-status`, por código. */
  labels: Record<number, string>;
}

/**
 * Selo do status do fornecedor na listagem.
 *
 * O status passa por `enumCode` porque a API o serializa pelo nome: indexar o
 * mapa de rótulos direto com `"Inactive"` devolvia `undefined`. O rótulo do
 * catálogo vale quando já carregou; antes disso, o fixo daqui.
 */
export function SupplierStatusBadge({ status, labels }: SupplierStatusBadgeProps) {
  const code = enumCode(status, SUPPLIER_STATUS);
  const style = STATUS_STYLES[code];

  if (!style) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        {labels[code] ?? "Sem status"}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={style.className}>
      {labels[code] ?? style.label}
    </Badge>
  );
}

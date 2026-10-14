import { supplierTypeLabel, type SupplierType } from "@workspace/api-client-react";

/**
 * O tipo do fornecedor na listagem (14/10/2026): selo discreto embaixo do nome,
 * e não coluna — a tabela já tem oito. Sem tipo (backend anterior), nada.
 */
export function SupplierTypeBadge({ type }: { type?: SupplierType | null }) {
  if (!type) return null;
  return (
    <span
      className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
      title="Tipo do fornecedor"
    >
      {supplierTypeLabel(type)}
    </span>
  );
}

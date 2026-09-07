import * as React from "react";
import { TableHead, cn } from "@workspace/ui";

type BiColumnHeaderProps = {
  children: React.ReactNode;
  className?: string;
  /** A definição da coluna. Sem ela o cabeçalho é um `TableHead` comum. */
  dica?: string;
};

/**
 * Cabeçalho de coluna com a definição embutida.
 *
 * As tabelas de BI têm colunas cujo nome não se explica sozinho — "acumulado",
 * "cesta", "giro", "dura", "em risco". A resposta precisa estar onde o cursor já
 * está: um rodapé com o glossário só alcança quem rolou a página inteira, e o
 * manual da tela é para quem já parou para estudar.
 *
 * O sublinhado pontilhado no hover é o que anuncia que há algo a ler ali. Sem
 * ele o `title` existe e ninguém descobre.
 */
export function BiColumnHeader({ children, className, dica }: BiColumnHeaderProps) {
  return (
    <TableHead
      title={dica}
      className={cn(
        "h-auto px-2 pb-2 text-[10.5px] uppercase tracking-wider",
        dica && "cursor-help decoration-dotted underline-offset-4 hover:underline",
        className,
      )}
    >
      {children}
    </TableHead>
  );
}

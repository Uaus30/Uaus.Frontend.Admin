import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead, cn } from "@workspace/ui";

type BiColumnHeaderProps = {
  children: React.ReactNode;
  className?: string;
  /** A definição da coluna. Sem ela o cabeçalho é um `TableHead` comum. */
  dica?: string;
  /**
   * Liga a ordenação por clique. Sem ele o cabeçalho continua sendo só texto —
   * é o que mantém as colunas que não medem nada (situação, ação sugerida) fora
   * do alcance do cursor.
   */
  onOrdenar?: () => void;
  /** A direção em vigor quando ESTA é a coluna que ordena; `null` quando não é. */
  ordem?: "asc" | "desc" | null;
  /** Para que lado o conteúdo da coluna encosta — a seta acompanha. */
  alinhamento?: "left" | "center" | "right";
};

const JUSTIFICACAO = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
} as const;

/**
 * Cabeçalho de coluna com a definição embutida e, quando pedido, ordenação.
 *
 * As tabelas de BI têm colunas cujo nome não se explica sozinho — "acumulado",
 * "cesta", "giro", "dura", "em risco". A resposta precisa estar onde o cursor já
 * está: um rodapé com o glossário só alcança quem rolou a página inteira, e o
 * manual da tela é para quem já parou para estudar.
 *
 * O sublinhado pontilhado no hover é o que anuncia que há algo a ler ali. Sem
 * ele o `title` existe e ninguém descobre.
 *
 * <b>A coluna é o próprio controle de ordenação</b>, e não um select à parte —
 * o mesmo caminho do relatório de estoque baixo. É onde a pessoa já está
 * olhando quando decide comparar. A seta apagada anuncia que a coluna responde
 * ao clique; a seta cheia diz para que lado ela está ordenando agora.
 */
export function BiColumnHeader({
  children,
  className,
  dica,
  onOrdenar,
  ordem,
  alinhamento = "left",
}: BiColumnHeaderProps) {
  const ordenavel = Boolean(onOrdenar);

  return (
    <TableHead
      title={ordenavel ? undefined : dica}
      aria-sort={
        !ordenavel ? undefined : ordem === "asc" ? "ascending" : ordem === "desc" ? "descending" : "none"
      }
      className={cn(
        "h-auto px-2 pb-2 text-[10.5px] uppercase tracking-wider",
        dica && !ordenavel && "cursor-help decoration-dotted underline-offset-4 hover:underline",
        ordenavel && "p-0",
        className,
      )}
    >
      {ordenavel ? (
        <button
          type="button"
          onClick={onOrdenar}
          title={dica ? `${dica}. Clique para ordenar.` : "Clique para ordenar."}
          className={cn(
            // `whitespace-nowrap` porque a seta é conteúdo em linha: sem ele,
            // "Em risco" quebra em duas e só aquela coluna fica com o cabeçalho
            // mais alto que as vizinhas. A coluna alarga, e a tabela já rola.
            "flex w-full items-center gap-1 whitespace-nowrap rounded px-2 pb-2 pt-1 uppercase tracking-wider transition-colors",
            "hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            JUSTIFICACAO[alinhamento],
            ordem && "text-foreground",
          )}
        >
          {children}
          {ordem === "asc" ? (
            <ArrowUp className="h-3 w-3 shrink-0 text-primary" />
          ) : ordem === "desc" ? (
            <ArrowDown className="h-3 w-3 shrink-0 text-primary" />
          ) : (
            <ArrowUpDown className="h-3 w-3 shrink-0 opacity-40" />
          )}
        </button>
      ) : (
        children
      )}
    </TableHead>
  );
}

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@workspace/ui";

interface StatementRowProps {
  /** O sinal da linha na conta: soma, subtrai ou é resultado. */
  sign?: "+" | "−" | "=";
  label: string;
  /** Valor já formatado, ou "—" quando o fechamento não tinha o número. */
  value: string;
  hint?: ReactNode;
  /** Linha de resultado (=): traço em cima e negrito. */
  emphasis?: boolean;
  /** Parcela de outra linha (promoção dentro do desconto no item): recuada e menor. */
  indent?: boolean;
  /** Cor do valor: verde é positivo, vermelho é negativo, âmbar é atenção. */
  tone?: "positive" | "negative" | "warning";
}

const TONE_CLASS: Record<NonNullable<StatementRowProps["tone"]>, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-destructive",
  warning: "text-amber-600 dark:text-amber-400",
};

/**
 * Uma linha da conta do fechamento ("− Custos fixos ... R$ 865,00").
 *
 * Lista, e não tabela: no celular em pé (375 px) a conta cabe em duas colunas —
 * o rótulo e o valor —, e a tabela de quatro colunas rolaria de lado.
 */
export function StatementRow({ sign, label, value, hint, emphasis, indent, tone }: StatementRowProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 py-1.5 text-sm",
        emphasis && "mt-1 border-t border-border/60 pt-2 font-semibold",
        indent && "py-0.5 pl-5 text-xs text-muted-foreground",
      )}
    >
      <div className="min-w-0">
        <span className="inline-block w-4 text-muted-foreground" aria-hidden>
          {sign}
        </span>
        {label}
        {hint && <span className="block pl-4 text-xs font-normal text-muted-foreground">{hint}</span>}
      </div>
      <span className={cn("shrink-0 tabular-nums", tone && TONE_CLASS[tone])}>{value}</span>
    </div>
  );
}

interface StatementSectionProps {
  icon: LucideIcon;
  title: string;
  /** Nota embaixo do título — a dos fechamentos da conta antiga, por exemplo. */
  note?: ReactNode;
  children: ReactNode;
}

/** Um bloco da conta (resultado, caixa), com título e as linhas. */
export function StatementSection({ icon: Icon, title, note, children }: StatementSectionProps) {
  return (
    <section className="space-y-1 rounded-lg border bg-card p-3 shadow-sm">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        {title}
      </h3>
      {note && <p className="text-xs text-amber-600 dark:text-amber-400">{note}</p>}
      <div>{children}</div>
    </section>
  );
}

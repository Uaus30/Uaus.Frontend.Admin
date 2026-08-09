import { TriangleAlert } from "lucide-react";

type FinancialReportWarningsProps = {
  /** Avisos vindos do backend — período parcial de mês, distribuição não configurada etc. */
  warnings: string[];
};

/**
 * FinancialReportWarnings
 *
 * Banner amber discreto com os avisos do resumo. Warnings não impedem a leitura
 * do relatório — quem recusa de fato é a confirmação do fechamento.
 */
export function FinancialReportWarnings({ warnings }: FinancialReportWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <div className="flex items-start gap-2.5">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-400">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

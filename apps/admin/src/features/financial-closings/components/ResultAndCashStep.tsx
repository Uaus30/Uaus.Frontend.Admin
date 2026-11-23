import { AlertTriangle } from "lucide-react";
import { ClosingResultBlock } from "./ClosingResultBlock";
import { ClosingCashBlock } from "./ClosingCashBlock";
import { VariableCostsTable } from "./VariableCostsTable";
import { FixedCostItemsTable } from "./FixedCostItemsTable";
import type { FinancialClosingPreviewDto, FinancialClosingVariableCostDto } from "../types";

interface ResultAndCashStepProps {
  preview: FinancialClosingPreviewDto;
  isImplantation: boolean;
  isRecalculating: boolean;
  onAddVariableCost: (cost: FinancialClosingVariableCostDto) => void;
  onRemoveVariableCost: (index: number) => void;
}

/**
 * Passo 2 do novo fechamento: o resultado (o lucro) e o caixa do mês, com os
 * custos variáveis editáveis como antes — cada linha lançada refaz a conta no
 * servidor, e a tela lista o eco da resposta.
 */
export function ResultAndCashStep({
  preview,
  isImplantation,
  isRecalculating,
  onAddVariableCost,
  onRemoveVariableCost,
}: ResultAndCashStepProps) {
  return (
    <div className="space-y-4">
      {preview.warnings.length > 0 && (
        <div className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
          {preview.warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{warning}</span>
            </p>
          ))}
        </div>
      )}

      <ClosingResultBlock closing={preview} writeOffsByReason={preview.writeOffsByReason} />

      <VariableCostsTable
        items={preview.variableCosts}
        total={preview.variableCostsTotal}
        onAdd={onAddVariableCost}
        onRemove={onRemoveVariableCost}
        isRecalculating={isRecalculating}
      />

      <FixedCostItemsTable items={preview.fixedCosts.items} />

      <ClosingCashBlock closing={preview} isImplantation={isImplantation} />
    </div>
  );
}

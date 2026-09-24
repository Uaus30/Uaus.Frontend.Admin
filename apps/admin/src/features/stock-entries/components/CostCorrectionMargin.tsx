import { formatPercentage, marginBand } from "@workspace/core";
import type { ReceivedPurchaseEntryItemDto } from "@workspace/api-client-react";
import { describeCostCorrectionMargin } from "../lib/cost-correction";
import { marginToneClass } from "../lib/margin-tone";

type CostCorrectionMarginProps = {
  item: ReceivedPurchaseEntryItemDto;
  /** Custo corrigido, como a célula o leu. */
  unitCost: number;
  formatCurrency: (value: number) => string;
};

/** O percentual na cor da faixa — a mesma de toda tela que mostra margem. */
function Margin({ value }: { value: number }) {
  return (
    <span className={`font-semibold ${marginToneClass(marginBand(value))}`}>{formatPercentage(value)}</span>
  );
}

/**
 * A margem antes e depois da correção de custo, abaixo do item na confirmação:
 * "de R$ 4,12 para R$ 5,00" diz o que muda, e esta linha diz o que isso faz com
 * o lucro do preço de venda. Regra em `describeCostCorrectionMargin`; sem margem
 * que ajude, não aparece.
 */
export function CostCorrectionMargin({ item, unitCost, formatCurrency }: CostCorrectionMarginProps) {
  const margin = describeCostCorrectionMargin(item, unitCost);
  if (!margin) return null;

  return (
    <p className="text-sm text-muted-foreground">
      Margem sobre o preço de venda ({formatCurrency(margin.price)}):{" "}
      {margin.before !== null && (
        <>
          de <Margin value={margin.before} /> para{" "}
        </>
      )}
      <Margin value={margin.after} />
    </p>
  );
}

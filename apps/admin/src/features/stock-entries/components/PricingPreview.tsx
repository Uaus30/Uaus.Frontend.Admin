import { Sparkles } from "lucide-react";
import { Button } from "@workspace/ui";
import {
  DEFAULT_TARGET_MARGIN_PERCENT,
  formatCurrency,
  formatPercentage,
  marginBand,
  marginPercent,
  markupPercent,
  suggestedPrice,
} from "@workspace/core";
import { marginToneClass } from "../lib/margin-tone";

type PricingPreviewProps = {
  /** Custo unitário digitado na entrada. */
  unitCost: number;
  /** Preço de venda digitado (o que vai valer no cadastro). */
  price: number;
  /** Aplica o preço sugerido no campo de preço. */
  onApplySuggested: (price: number) => void;
};

/**
 * Margem, markup e preço sugerido da entrada, calculados enquanto o operador
 * digita o custo.
 *
 * Existe porque o preço lançado na entrada PASSA A VALER no cadastro do
 * produto, e até aqui a modal não dizia nada sobre a conta: quem recebia
 * mercadoria a custo novo tinha que calcular de cabeça se o preço antigo ainda
 * dava lucro. A sugestão segue a regra da loja (`DEFAULT_TARGET_MARGIN_PERCENT`
 * de margem, em múltiplos de 10 centavos) e é um clique para aplicar — sugerir
 * não é impor.
 *
 * Sem custo o bloco some: brinde e bonificação entram a custo zero, e mostrar
 * "margem 100%" para eles seria informação enganosa.
 */
export function PricingPreview({ unitCost, price, onApplySuggested }: PricingPreviewProps) {
  const suggested = suggestedPrice(unitCost);
  if (suggested === null) return null;

  const margin = marginPercent(unitCost, price);
  const markup = markupPercent(unitCost, price);
  const alreadySuggested = price > 0 && Math.abs(price - suggested) < 0.005;

  return (
    <div
      data-testid="pricing-preview"
      className="flex flex-col gap-2 rounded-xl border border-border/40 bg-muted/20 px-4 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="text-muted-foreground">
          Margem prevista:{" "}
          <span className={`font-semibold ${marginToneClass(marginBand(margin))}`}>
            {margin === null ? "—" : formatPercentage(margin)}
          </span>
        </span>
        <span className="text-muted-foreground">
          Markup:{" "}
          <span className="font-semibold text-foreground">
            {markup === null ? "—" : formatPercentage(markup)}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">
          Sugerido ({DEFAULT_TARGET_MARGIN_PERCENT}% de margem):{" "}
          <span className="font-semibold text-foreground">{formatCurrency(suggested)}</span>
        </span>
        {/* `type="button"`: a modal é um <form>, e um botão sem tipo enviaria a
            entrada ao aplicar o preço. */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          disabled={alreadySuggested}
          onClick={() => onApplySuggested(suggested)}
        >
          <Sparkles className="h-3 w-3" />
          {alreadySuggested ? "Aplicado" : "Usar sugerido"}
        </Button>
      </div>
    </div>
  );
}

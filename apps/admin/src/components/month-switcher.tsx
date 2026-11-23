import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, cn } from "@workspace/ui";
import { formatMonthKey, shiftMonthKey } from "@workspace/core";

interface MonthSwitcherProps {
  /** Mês exibido, `"yyyy-MM"`. */
  month: string;
  onChange: (month: string) => void;
  /** Último mês que se pode escolher (o corrente, em geral). Sem ele, não há teto. */
  maxMonth?: string;
  className?: string;
}

/**
 * Seletor de mês do financeiro: anterior, o mês por extenso e o próximo.
 *
 * Setas, e não um select de doze meses: quem olha o financeiro quase sempre
 * quer o mês corrente ou o anterior, e no celular uma seta é um toque, um select
 * são três. "yyyy-MM" ordena como data, então o teto é comparação de texto.
 */
export function MonthSwitcher({ month, onChange, maxMonth, className }: MonthSwitcherProps) {
  const atMax = maxMonth != null && month >= maxMonth;

  return (
    <div className={cn("flex items-center gap-1 rounded-lg border bg-card p-1 shadow-sm", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => onChange(shiftMonthKey(month, -1))}
        aria-label="Mês anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[10rem] text-center text-sm font-semibold text-foreground" aria-live="polite">
        {formatMonthKey(month)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        onClick={() => onChange(shiftMonthKey(month, 1))}
        disabled={atMax}
        aria-label="Próximo mês"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

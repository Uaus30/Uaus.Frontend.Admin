import { Snowflake } from "lucide-react";

type StockFreezeBannerProps = {
  /** Vendas pausadas pela conferência de estoque em andamento. */
  salesPaused: boolean;
};

/**
 * "Vendas pausadas" no topo do balcão enquanto há conferência de estoque aberta.
 *
 * Âmbar, como a faixa de "sem conexão": não é defeito do PDV, é um estado
 * previsto — e o texto diz o que fazer, porque o operador não é quem abriu a
 * conferência e precisa saber que a saída é o encerramento, lá no admin.
 */
export function StockFreezeBanner({ salesPaused }: StockFreezeBannerProps) {
  if (!salesPaused) return null;

  return (
    <div
      role="status"
      className="flex h-10 shrink-0 items-center justify-center gap-2 bg-amber-500 px-4 text-center text-xs font-medium text-amber-950 shadow-md sm:text-sm"
    >
      <Snowflake className="h-4 w-4 shrink-0" />
      <span>
        Conferência de estoque em andamento — vendas e baixas pausadas até ela ser encerrada no admin.
      </span>
    </div>
  );
}

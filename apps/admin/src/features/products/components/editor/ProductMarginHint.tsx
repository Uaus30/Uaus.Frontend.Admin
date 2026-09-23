import { formatCurrency, formatPercentage, marginBand, marginPercent } from "@workspace/core";
import { marginToneClass } from "@/features/stock-entries/lib/margin-tone";

type ProductMarginHintProps = {
  /** Custo da última entrada — o mesmo do campo "Último custo". */
  cost: number | null | undefined;
  /** Preço de venda como está no campo, inclusive enquanto se digita. */
  price: number;
};

/**
 * A margem que o preço de venda dá sobre o último custo, logo abaixo do preço
 * (pedido do dono, 23/09/2026): é a conta que se fazia de cabeça ao decidir o
 * preço com o custo na vista.
 *
 * Faixa e cor são as de toda tela que mostra margem — `marginBand` do
 * `packages/core` e `marginToneClass`, os mesmos da prévia da entrada e do
 * histórico de entradas. Um corte próprio aqui faria o mesmo preço sair verde no
 * detalhe e amarelo na entrada.
 *
 * Sem custo (cadastro novo, produto que nunca teve entrada) não aparece: sem
 * custo não há margem a mostrar, e "100%" seria mentira.
 */
export function ProductMarginHint({ cost, price }: ProductMarginHintProps) {
  if (cost == null || !(cost > 0)) return null;

  const margin = marginPercent(cost, price);

  return (
    <p
      className="text-xs text-muted-foreground"
      title={`Sobre o último custo (${formatCurrency(cost)}). Verde a partir de 40%, amarelo de 30% a 40%, vermelho abaixo de 30%.`}
    >
      Margem:{" "}
      <span className={`font-semibold ${marginToneClass(marginBand(margin))}`}>
        {margin === null ? "—" : formatPercentage(margin)}
      </span>
    </p>
  );
}

import { formatCurrency, formatPercentage, marginBand, marginPercent } from "@workspace/core";
import { marginToneClass } from "@/features/stock-entries/lib/margin-tone";
import type { MarginBase } from "../../lib/costAndStock";

type ProductMarginHintProps = {
  /** O custo da margem e de onde ele veio — ver `resolveMarginBase`. */
  base: MarginBase | null;
  /** Preço de venda como está no campo, inclusive enquanto se digita. */
  price: number;
};

/**
 * A margem que o preço de venda dá sobre o custo, logo abaixo do preço (pedido
 * do dono, 23/09/2026): é a conta que se fazia de cabeça ao decidir o preço com
 * o custo na vista.
 *
 * Faixa e cor são as de toda tela que mostra margem — `marginBand` do
 * `packages/core` e `marginToneClass`, os mesmos da prévia da entrada e do
 * histórico de entradas. Um corte próprio aqui faria o mesmo preço sair verde no
 * detalhe e amarelo na entrada.
 *
 * O custo é o da última entrada. No cadastro vindo de uma compra, antes de a
 * entrada existir, é o da compra — e o rótulo diz qual, porque logo acima o
 * "Último custo" ainda mostra "-". Sem custo nenhum não aparece: sem custo não
 * há margem, e "100%" seria mentira.
 */
export function ProductMarginHint({ base, price }: ProductMarginHintProps) {
  if (!base) return null;

  const margin = marginPercent(base.cost, price);
  const origem =
    base.purchaseId === null
      ? `Sobre o último custo (${formatCurrency(base.cost)})`
      : `Sobre o custo da compra #${base.purchaseId} (${formatCurrency(base.cost)}), até a entrada ser lançada`;

  return (
    <p
      className="text-xs text-muted-foreground"
      title={`${origem}. Verde a partir de 40%, amarelo de 30% a 40%, vermelho abaixo de 30%.`}
    >
      Margem:{" "}
      <span className={`font-semibold ${marginToneClass(marginBand(margin))}`}>
        {margin === null ? "—" : formatPercentage(margin)}
      </span>
      {base.purchaseId !== null && (
        <>
          {" "}
          · sobre o custo da compra #{base.purchaseId} ({formatCurrency(base.cost)})
        </>
      )}
    </p>
  );
}

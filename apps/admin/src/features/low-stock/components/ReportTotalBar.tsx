import { Checkbox } from "@workspace/ui";

type ReportTotalBarProps = {
  /** Quantos produtos a lista tem, com os filtros da tela. */
  total: number;
  /** O que vem depois do número: "para repor" no relatório; nada na Lista de Compras. */
  suffix?: string;
  isLoading: boolean;
  includePurchasesInTransit: boolean;
  onIncludePurchasesInTransitChange: (value: boolean) => void;
  /**
   * Quantos ficaram de fora por já terem compra A caminho. Só aparece com a
   * caixa desmarcada e acima de zero; ausente, a tela não sabe dizer e cala.
   */
  excludedWithPurchaseInTransit?: number;
};

/**
 * O totalizador e a caixa "Incluir os com compra a caminho" (14/10/2026), das
 * duas telas da feature.
 *
 * A caixa nasce **desmarcada**: produto com compra **A caminho** já está
 * resolvido — a mercadoria está vindo —, e contá-lo no total e no alerta
 * vermelho do painel só ensinava a ignorar o número. É o critério do selo
 * "Comprado" da listagem de produtos. A compra **Pendente** não tira ninguém:
 * ela é anotação, o pedido ainda não saiu. Marcar a caixa é o "ver tudo".
 *
 * Desmarcada, o "+ M com compra a caminho" diz quantos ficaram de fora, para o
 * número menor não parecer que a lista perdeu produto.
 */
export function ReportTotalBar({
  total,
  suffix,
  isLoading,
  includePurchasesInTransit,
  onIncludePurchasesInTransitChange,
  excludedWithPurchaseInTransit = 0,
}: ReportTotalBarProps) {
  const quantos = `${total} ${total === 1 ? "produto" : "produtos"}${suffix ? ` ${suffix}` : ""}`;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
      <p className="text-sm text-muted-foreground" data-testid="report-total" aria-live="polite">
        <strong className="text-base font-semibold text-foreground">
          {isLoading ? "Contando..." : quantos}
        </strong>
        {!includePurchasesInTransit && excludedWithPurchaseInTransit > 0 && (
          <span title="Já têm compra A caminho — marque a caixa para vê-los">
            {" "}
            · + {excludedWithPurchaseInTransit} com compra a caminho
          </span>
        )}
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Checkbox
          checked={includePurchasesInTransit}
          onCheckedChange={(value) => onIncludePurchasesInTransitChange(value === true)}
        />
        Incluir os com compra a caminho
      </label>
    </div>
  );
}

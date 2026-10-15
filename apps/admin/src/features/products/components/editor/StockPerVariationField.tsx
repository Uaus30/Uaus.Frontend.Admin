import type React from "react";
import { Switch } from "@workspace/ui";
import type { ProductGroupForm } from "../../types";

type StockPerVariationFieldProps = {
  form: ProductGroupForm;
  setForm: React.Dispatch<React.SetStateAction<ProductGroupForm>>;
};

/**
 * "Controlar estoque por variação" (15/10/2026), só no produto com variações.
 *
 * Desligado — o padrão —, o relatório de estoque baixo, o alerta, a previsão, a
 * rotina de desempenho, o "Comprar!" da listagem, a reposição do BI e o ranking
 * de campeões olham o produto INTEIRO, com saldo e venda somados: a sacola de
 * quatro estampas é uma linha, e não quatro de giro baixo. Ligado, cada variação
 * é julgada sozinha — é o caso da roupa íntima, em que acabar o P com o G
 * sobrando é falta de verdade.
 *
 * Venda, compra e contagem continuam por variação nos dois casos: o caixa
 * confere o saldo do código bipado. O salvar só manda o interruptor quando a
 * pessoa mexeu nele nesta tela (`useProductSubmit`).
 */
export function StockPerVariationField({ form, setForm }: StockPerVariationFieldProps) {
  if (!form.hasVariations) return null;

  const ligado = form.stockPerVariation ?? false;

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <label className="flex h-10 w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-border/50 bg-card px-3 text-sm transition-colors hover:bg-muted/50">
        <span className="font-medium">Controlar estoque por variação</span>
        <Switch
          checked={ligado}
          onCheckedChange={(checked) =>
            setForm((current) => ({ ...current, stockPerVariation: checked === true }))
          }
          aria-label="Controlar estoque por variação"
        />
      </label>
      <p className="text-xs text-muted-foreground">
        {ligado
          ? "O estoque baixo e os alertas julgam cada variação sozinha — use quando faltar um tamanho ou uma cor é falta de verdade."
          : "O estoque baixo e os alertas olham o total do produto, somando as variações. A venda continua pelo código de cada variação."}
      </p>
    </div>
  );
}

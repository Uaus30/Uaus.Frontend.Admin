import type { LowStockItem } from "../types";

/**
 * A linha embaixo do nome do produto: o código de barras, ou — na linha do
 * produto com variações julgado pelo total (15/10/2026) — de quantas variações
 * saem o saldo e a venda. O grupo tem um código por variação, e mostrar o de
 * uma delas faria a linha parecer daquela cor.
 */
export function LowStockCodeLine({ item }: { item: LowStockItem }) {
  if (!item.isGroup) {
    return <p className="font-mono text-xs text-muted-foreground">{item.barcode}</p>;
  }

  return (
    <p
      className="text-xs text-muted-foreground"
      title="O controle de estoque deste produto é pelo total: saldo, mínimo e venda somam as variações. Para julgar cada uma, ligue “Controlar estoque por variação” no cadastro."
    >
      Total de {item.variationCount} {item.variationCount === 1 ? "variação" : "variações"}
    </p>
  );
}

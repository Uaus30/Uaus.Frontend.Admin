import { Boxes, Gem, ShoppingBasket, TriangleAlert } from "lucide-react";
import { Card, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { AbcFindingsDto, ProductAbcSummaryDto } from "@workspace/api-client-react";
import { formatPercent, plural } from "@/features/supplier-performance/lib/format";
import type { AbcFindingKey } from "../hooks/useProductAbc";

type AbcFindingsProps = {
  findings: AbcFindingsDto;
  summary: ProductAbcSummaryDto;
  selected: AbcFindingKey | null;
  onSelect: (chave: AbcFindingKey, ids: number[]) => void;
};

/**
 * As quatro leituras que exigem cruzar mais de um número.
 *
 * Nenhuma delas cabe numa coluna da tabela: todas comparam o produto com outra
 * coisa — a própria margem, a média da cesta, o capital que ele imobiliza. São
 * cards e não linhas porque cada um é uma decisão de compra diferente.
 */
export function AbcFindings({ findings, summary, selected, onSelect }: AbcFindingsProps) {
  const margemDasArmadilhas =
    findings.revenueTraps.revenue > 0
      ? (findings.revenueTraps.profit / findings.revenueTraps.revenue) * 100
      : 0;

  const parteDoEstoqueNaCauda =
    summary.stockCost > 0 ? (summary.stockCostInClassC / summary.stockCost) * 100 : 0;

  const cards = [
    {
      chave: "revenueTraps" as const,
      icone: TriangleAlert,
      tom: "alerta" as const,
      titulo: "Armadilhas de faturamento",
      valor: plural(findings.revenueTraps.products, "produto", "produtos"),
      frase:
        findings.revenueTraps.products === 0
          ? "Nenhum produto classe A em faturamento ficou fora da classe A de lucro."
          : `Classe A em faturamento, mas não em lucro. Somam ${formatCurrency(findings.revenueTraps.revenue)} de venda com ${formatCurrency(findings.revenueTraps.profit)} de lucro — margem de ${formatPercent(margemDasArmadilhas)}, contra ${formatPercent(summary.margin)} da loja.`,
      ids: findings.revenueTraps.productIds,
    },
    {
      chave: "hiddenGems" as const,
      icone: Gem,
      tom: "bom" as const,
      titulo: "Joias escondidas",
      valor: plural(findings.hiddenGems.products, "produto", "produtos"),
      frase:
        findings.hiddenGems.products === 0
          ? "Nenhum produto fora da classe A de faturamento entrou na classe A de lucro."
          : `Não estão entre os campeões de venda, mas entregam ${formatCurrency(findings.hiddenGems.profit)} de lucro. Vale dar espaço melhor na loja e testar mais estoque.`,
      ids: findings.hiddenGems.productIds,
    },
    {
      chave: "tailThatPullsBasket" as const,
      icone: ShoppingBasket,
      tom: "bom" as const,
      titulo: "Cauda que puxa cesta",
      valor: plural(findings.tailThatPullsBasket.products, "produto", "produtos"),
      frase:
        findings.tailThatPullsBasket.products === 0
          ? "Nenhum item da cauda aparece em cestas maiores que a média."
          : `Produtos da cauda que só aparecem em compras acima do ticket médio (${formatCurrency(summary.averageTicket)}). Cortá-los não economiza o que eles custam — a cesta inteira vem junto.`,
      ids: findings.tailThatPullsBasket.productIds,
    },
    {
      chave: "misplacedStock" as const,
      icone: Boxes,
      tom: "alerta" as const,
      titulo: "Capital na cauda",
      valor: formatCurrency(findings.misplacedStock.amount),
      frase:
        findings.misplacedStock.products === 0
          ? "Nenhum capital parado em produtos classe C."
          : `${formatPercent(parteDoEstoqueNaCauda)} do estoque está em ${plural(findings.misplacedStock.products, "produto classe C", "produtos classe C")} — dinheiro imobilizado nos itens que menos giram.`,
      ids: findings.misplacedStock.productIds,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const ativo = selected === card.chave;
        const clicavel = card.ids.length > 0;

        return (
          <Card
            key={card.chave}
            role={clicavel ? "button" : undefined}
            tabIndex={clicavel ? 0 : undefined}
            onClick={() => clicavel && onSelect(card.chave, card.ids)}
            onKeyDown={(event) => {
              if (clicavel && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onSelect(card.chave, card.ids);
              }
            }}
            className={cn(
              "flex flex-col gap-2 border-border/60 p-4 transition-colors",
              clicavel && "cursor-pointer hover:border-primary/50",
              ativo && "border-primary ring-1 ring-primary",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-lg p-1.5",
                  card.tom === "alerta"
                    ? "bg-orange-500/12 text-orange-300"
                    : "bg-emerald-500/12 text-emerald-300",
                )}
              >
                <card.icone className="h-4 w-4" />
              </span>
              <p className="text-[12.5px] font-semibold">{card.titulo}</p>
            </div>

            <p className="text-[22px] font-semibold leading-none tracking-tight">{card.valor}</p>
            <p className="text-[11.5px] leading-relaxed text-muted-foreground">{card.frase}</p>
          </Card>
        );
      })}
    </div>
  );
}

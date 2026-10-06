import React from "react";
import { Badge } from "@workspace/ui";
import { ShelfPriceView } from "@/components/shelf-price";
import { PRODUCT_STATUS, enumCode, type EnumOptionDto } from "@workspace/api-client-react";
import type { ProductTableRowVariation } from "../types";
import { ProductStockCell } from "./ProductStockCell";

type ProductTableVariationsProps = {
  /** As variações do grupo, na ordem que o servidor mandou (id crescente). */
  variations: ProductTableRowVariation[];
  /** Do GRUPO: igual em todas as variações, repetido para a linha ficar completa. */
  departmentName: string;
  statusOptions: EnumOptionDto[];
  /** Colunas da tabela de cima, para o `colSpan` cobrir a linha inteira. */
  colSpan: number;
};

/**
 * As variações do grupo, aninhadas embaixo da linha da listagem.
 *
 * **Somente leitura, e sem menu de ações.** Quem vai mexer numa variação abre o
 * cadastro: aqui o objetivo é responder "o que tem dentro deste grupo?" sem
 * tirar a pessoa da listagem — a dúvida que a linha sozinha não respondia, já
 * que ela mostra o preço e o status de UMA das variações (a de maior id) e a
 * soma do estoque de todas.
 *
 * **Categoria e etiquetas ficaram de fora** (decisão do dono, 12/09/2026): a
 * categoria é do GRUPO e repetiria a linha de cima em toda variação, e a
 * etiqueta quase nunca é o que distingue uma variação da outra — as duas colunas
 * só empurravam para a direita o que importa aqui, que é preço e estoque por
 * variação. Departamento ficou, por ser a âncora de leitura da linha.
 *
 * É uma tabela PRÓPRIA, com cabeçalho próprio, e não linhas alinhadas às
 * colunas de cima: alinhar obrigaria a repetir as larguras da tabela externa em
 * dois lugares, e a primeira mudança de coluna lá em cima desalinharia aqui sem
 * ninguém perceber. O cabeçalho também resolve a lista longa, em que o da
 * tabela principal já rolou para fora da tela.
 */
function StatusBadge({
  status,
  statusOptions,
}: {
  status: ProductTableRowVariation["status"];
  statusOptions: EnumOptionDto[];
}) {
  const code = enumCode(status, PRODUCT_STATUS);
  return (
    <Badge variant={code === PRODUCT_STATUS.Active ? "default" : "outline"}>
      {statusOptions.find((option) => option.id === code)?.name ?? "—"}
    </Badge>
  );
}

export function ProductTableVariations({
  variations,
  departmentName,
  statusOptions,
  colSpan,
}: ProductTableVariationsProps) {
  return (
    <tr className="border-b border-border/50 bg-muted/10">
      {/* O recuo à esquerda é o que faz a leitura de "está dentro daquela linha". */}
      <td colSpan={colSpan} className="px-3 py-3 md:px-6 lg:pl-16">
        {/* Celular e tablet: uma lista empilhada — nome em cima, preço, estoque e
            situação embaixo. A tabela de quatro colunas, dentro da caixa de
            borda arredondada (`overflow-hidden`), CORTAVA a coluna de status sem
            deixar rolar até ela. */}
        <ul className="divide-y divide-border/30 overflow-hidden rounded-xl border border-border/50 bg-background/40 text-xs lg:hidden">
          {variations.map((variation) => (
            <li key={variation.id} className="space-y-1 px-3 py-2">
              <p className="break-words font-medium text-foreground">{variation.name}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-orange-500">
                  <ShelfPriceView shelf={variation.shelf ?? { kind: "regular", price: variation.price }} />
                </span>
                <ProductStockCell
                  variant="text"
                  stock={variation.stock}
                  atMinimumStock={variation.atMinimumStock}
                  needsRestock={variation.needsRestock}
                  purchaseInTransit={variation.purchaseInTransit}
                />
                <StatusBadge status={variation.status} statusOptions={statusOptions} />
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-hidden rounded-xl border border-border/50 bg-background/40 lg:block">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border/50 bg-muted/30 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Variação</th>
                <th className="px-4 py-2 font-medium">Departamento</th>
                <th className="px-4 py-2 font-medium">Preço</th>
                <th className="px-4 py-2 font-medium">Estoque</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {variations.map((variation) => (
                <tr key={variation.id} className="border-b border-border/30 last:border-0">
                  <td className="px-4 py-2 font-medium text-foreground">{variation.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{departmentName}</td>
                  <td className="px-4 py-2 font-medium text-orange-500">
                    {/* O percentual dá um preço promocional por variação. */}
                    <ShelfPriceView shelf={variation.shelf ?? { kind: "regular", price: variation.price }} />
                  </td>
                  <td className="px-4 py-2">
                    {/* A mesma célula da linha de cima: quem lê a listagem inteira
                        não pode precisar de duas regras de cor para "está acabando". */}
                    <ProductStockCell
                      stock={variation.stock}
                      atMinimumStock={variation.atMinimumStock}
                      needsRestock={variation.needsRestock}
                      purchaseInTransit={variation.purchaseInTransit}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={variation.status} statusOptions={statusOptions} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

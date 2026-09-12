import React from "react";
import { Badge } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { PRODUCT_STATUS, enumCode, type EnumOptionDto } from "@workspace/api-client-react";
import type { ProductTableRowVariation } from "../types";

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
export function ProductTableVariations({
  variations,
  departmentName,
  statusOptions,
  colSpan,
}: ProductTableVariationsProps) {
  return (
    <tr className="border-b border-border/50 bg-muted/10">
      {/* O recuo à esquerda é o que faz a leitura de "está dentro daquela linha". */}
      <td colSpan={colSpan} className="px-6 py-3 pl-16">
        <div className="overflow-hidden rounded-xl border border-border/50 bg-background/40">
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
                  <td className="px-4 py-2 font-medium text-orange-500">{formatCurrency(variation.price)}</td>
                  <td className="px-4 py-2">
                    {/* A mesma faixa da linha de cima: quem lê a listagem inteira
                        não pode precisar de duas regras de cor para "está acabando". */}
                    <span
                      className={`inline-block w-max rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        variation.stock < 10
                          ? "bg-destructive/20 text-destructive"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {variation.stock} un
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={
                        enumCode(variation.status, PRODUCT_STATUS) === PRODUCT_STATUS.Active
                          ? "default"
                          : "outline"
                      }
                    >
                      {statusOptions.find(
                        (option) => option.id === enumCode(variation.status, PRODUCT_STATUS),
                      )?.name ?? "—"}
                    </Badge>
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

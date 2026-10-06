import React from "react";
import type { LowStockItem } from "../types";
import { duracaoLegivel, duracaoTone } from "../lib/duracao";

/**
 * O resumo da linha no celular e no tablet (abaixo de `lg`, 06/10/2026).
 *
 * A tabela tinha largura mínima de 44rem e rolava de lado: num celular o
 * "Comprar" e o menu só apareciam depois de arrastar ~450px — e eram as duas
 * coisas que se vinha fazer aqui. Agora as colunas saem (convenção "esconder
 * coluna, nunca rolar") e o essencial vem embaixo do nome: saldo / mínimo,
 * fornecedor, vendas de 30 dias e quanto dura — com as ações logo abaixo
 * (`actions`). Do `lg` ao `2xl` a tabela é a de antes: saldo e fornecedor
 * continuam só no produto e no XLSX, como já eram.
 */
export function LowStockRowSummary({ item, actions }: { item: LowStockItem; actions: React.ReactNode }) {
  return (
    <div className="mt-1.5 space-y-2 lg:hidden">
      <p className="text-xs text-muted-foreground">
        Estoque <span className="font-mono font-semibold text-destructive">{item.stock}</span>
        <span className="font-mono"> / {item.effectiveMinStock ?? item.minStock}</span>
        {item.supplierName && <> · {item.supplierName}</>}
      </p>
      <p className="text-xs text-muted-foreground">
        {item.recentSales > 0 ? `Vendeu ${item.recentSales} em 30 dias` : "Sem venda em 30 dias"}
        {" · dura "}
        <span className={duracaoTone(item.daysOfCover, item.stock)}>
          {duracaoLegivel(item.daysOfCover, item.stock)}
        </span>
      </p>
      <div className="flex justify-start">{actions}</div>
    </div>
  );
}

import React from "react";
import { formatCurrency } from "@workspace/core";
import type { CatalogReport } from "@/services/mappers";

/** Converte `yyyy-MM-dd` em `dd/MM/yyyy` sem passar por `Date`, evitando fuso. */
function toBrazilianDate(value: string) {
  const [year, month, day] = value.split("T")[0].split("-");
  return `${day}/${month}/${year}`;
}

type CatalogReportBodyProps = {
  report: CatalogReport;
  /** Texto exibido quando o recorte não tem nenhum produto cadastrado. */
  emptyMessage: string;
};

/**
 * CatalogReportBody
 *
 * Corpo compartilhado dos relatórios de categoria e de etiqueta: o conteúdo é o
 * mesmo nos dois casos, só muda o recorte que define quais produtos entram.
 *
 * Produtos sem venda no período aparecem zerados em vez de sumirem da lista — o
 * relatório serve tanto para ver o que vendeu quanto para descobrir o que está
 * parado na prateleira, e esconder o segundo caso é justamente perder metade da
 * informação.
 */
export function CatalogReportBody({ report, emptyMessage }: CatalogReportBodyProps) {
  if (report.productCount === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 py-12">
        <p className="max-w-xs text-center text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  const summary = [
    { label: "Faturamento", value: formatCurrency(report.totalRevenue), highlight: true },
    { label: "Lucro", value: formatCurrency(report.totalProfit) },
    { label: "Vendas", value: String(report.totalSales) },
    { label: "Estoque", value: `${report.totalStock} un` },
  ];

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Período de {toBrazilianDate(report.startDate)} a {toBrazilianDate(report.endDate)} ·{" "}
        {report.productCount} produto(s) · margem de {report.marginPercentage.toFixed(1).replace(".", ",")}%
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summary.map((card) => (
          <div key={card.label} className="rounded-xl border border-border/50 bg-background/50 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p
              className={`mt-1 text-lg font-semibold tabular-nums ${card.highlight ? "text-primary" : "text-foreground"}`}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="max-h-[320px] overflow-auto rounded-xl border border-border/50">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="sticky top-0 bg-card text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr className="border-b border-border/60">
              <th className="px-3 py-2 font-medium">Produto</th>
              <th className="px-3 py-2 text-right font-medium">Preço</th>
              <th className="px-3 py-2 text-right font-medium">Estoque</th>
              <th className="px-3 py-2 text-right font-medium">Vendidos</th>
              <th className="px-3 py-2 text-right font-medium">Faturamento</th>
            </tr>
          </thead>
          <tbody>
            {report.products.map((product) => (
              <tr key={product.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20">
                <td className="max-w-[220px] px-3 py-2.5">
                  <p className="truncate font-medium text-foreground" title={product.name}>
                    {product.name}
                  </p>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                  {formatCurrency(product.price)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{product.stock} un</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{product.quantitySold}</td>
                <td className="px-3 py-2.5 text-right font-medium tabular-nums text-primary">
                  {formatCurrency(product.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

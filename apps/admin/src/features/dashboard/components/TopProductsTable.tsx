import React from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";

type TopProductItem = {
  id: number;
  name: string;
  totalSales: number;
  totalRevenue: number;
  stock: number;
};

type TopProductsTableProps = {
  /** List of top-selling products */
  topProducts: TopProductItem[];
};

function MockBadge() {
  return (
    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
      Dados mockados
    </span>
  );
}

/**
 * TopProductsTable
 * 
 * Component rendering the top-selling products table with Framer Motion entry effects.
 */
export function TopProductsTable({ topProducts }: TopProductsTableProps) {
  return (
    <Card className="border-border/50 p-6 shadow-lg shadow-black/5">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">Produtos Mais Vendidos</h3>
        <MockBadge />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="rounded-tl-lg rounded-tr-lg border-b border-border bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Vendas</th>
              <th className="px-4 py-3">Faturamento</th>
              <th className="px-4 py-3">Estoque Atual</th>
            </tr>
          </thead>
          <tbody>
            {topProducts.map((product, index) => (
              <motion.tr
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                key={product.id}
                className="border-b border-border/50 transition-colors hover:bg-muted/30"
              >
                <td className="px-4 py-4 font-medium">{product.name}</td>
                <td className="px-4 py-4">{product.totalSales} un</td>
                <td className="px-4 py-4 font-medium text-primary">{formatCurrency(product.totalRevenue)}</td>
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      product.stock < 10
                        ? "bg-destructive/20 text-destructive"
                        : "bg-emerald-500/20 text-emerald-400"
                    }`}
                  >
                    {product.stock} un
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

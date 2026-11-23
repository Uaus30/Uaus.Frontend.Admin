import { Warehouse } from "lucide-react";
import { Card, CardContent, Skeleton } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { PurchaseBudgetDto } from "../types";

interface StockAtCostCardProps {
  budget?: PurchaseBudgetDto;
  isLoading: boolean;
}

/**
 * StockAtCostCard
 *
 * O estoque de hoje a custo e quantos dias ele dura no ritmo de venda dos
 * últimos 90 dias.
 *
 * É o contrapeso do saldo e do aporte (seção 7.1): verde com saldo ainda é
 * estoque crescendo. Sem este número ao lado da faixa, comprar com o dinheiro
 * de um aporte pareceria sempre uma boa notícia.
 */
export function StockAtCostCard({ budget, isLoading }: StockAtCostCardProps) {
  if (isLoading) return <Skeleton className="h-28 rounded-xl" />;
  if (!budget) return null;

  return (
    <Card className="border-border/50">
      <CardContent className="flex items-start gap-3 p-4">
        <Warehouse className="mt-1 h-5 w-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Estoque a custo
          </p>
          <p className="text-2xl font-display font-bold tabular-nums text-foreground">
            {formatCurrency(budget.stockValueAtCost)}
          </p>
          <p className="text-sm text-muted-foreground">
            {budget.stockDays == null
              ? "Sem venda nos últimos 90 dias para medir quanto ele dura."
              : `${Math.round(budget.stockDays).toLocaleString("pt-BR")} dias de estoque no ritmo dos últimos 90 dias.`}
          </p>
          <p className="text-xs text-muted-foreground">
            Faixa verde com saldo ou aporte ainda é estoque crescendo.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

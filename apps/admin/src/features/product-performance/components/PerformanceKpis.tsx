import * as React from "react";
import { AlertTriangle, Boxes, Package, Repeat, TrendingUp } from "lucide-react";
import { Card } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { ProductPerformanceTotalsDto } from "@workspace/api-client-react";
import { formatInteger, formatPercent, plural } from "@/features/supplier-performance/lib/format";

type PerformanceKpisProps = {
  totals: ProductPerformanceTotalsDto;
};

/**
 * Os quatro números do período.
 *
 * O terceiro e o quarto são o motivo desta tela existir. "Capital em risco" não
 * é o estoque total nem o estoque parado: é a soma, produto a produto, do que
 * está na prateleira PONDERADO pela nota — dos R$ 400 de um item nota 10, R$ 360
 * estão em risco; de um nota 90, R$ 40. Um total de estoque sozinho não separa
 * o dinheiro que está trabalhando do que está dormindo.
 */
export function PerformanceKpis({ totals }: PerformanceKpisProps) {
  const parteEmRisco = totals.stockCost > 0 ? (totals.capitalAtRisk / totals.stockCost) * 100 : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi
        icon={Package}
        label="Produtos analisados"
        value={formatInteger(totals.products)}
        hint={
          <>
            {plural(totals.soldProducts, "vendeu", "venderam")} no período ·{" "}
            <strong className="text-destructive">{formatInteger(totals.stalledProducts)}</strong> não venderam
            nada
            {totals.newProducts > 0 && (
              <> · {plural(totals.newProducts, "recém-chegado", "recém-chegados")} fora dos rankings</>
            )}
          </>
        }
      />
      <Kpi
        icon={TrendingUp}
        label="Lucro bruto no período"
        value={formatCurrency(totals.profit)}
        hint={`${formatCurrency(totals.revenue)} de venda com margem de ${formatPercent(totals.margin)} · ${formatInteger(totals.units)} unidades`}
      />
      <Kpi
        icon={Repeat}
        label="Giro da loja no período"
        value={formatPercent(totals.sellThrough, 0)}
        hint={`de tudo que existia — o vendido mais o que sobrou — ${formatPercent(totals.sellThrough, 0)} saiu. É a régua da nota de giro de cada produto.`}
      />
      <Kpi
        icon={totals.capitalAtRisk > 0 ? AlertTriangle : Boxes}
        label="Capital em risco"
        value={formatCurrency(totals.capitalAtRisk)}
        hint={
          <>
            {formatPercent(parteEmRisco, 0)} dos {formatCurrency(totals.stockCost)} em estoque ·{" "}
            <strong className="text-destructive">{formatCurrency(totals.stalledStockCost)}</strong> em
            produtos que não venderam
          </>
        }
      />
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint: React.ReactNode;
}) {
  return (
    <Card className="border-border/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[12.5px] text-muted-foreground">{label}</p>
        <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-[26px] font-semibold tracking-tight">{value}</p>
      <div className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">{hint}</div>
    </Card>
  );
}

import React, { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Skeleton, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import type { DashboardBreakdown } from "../types";
import { buildDepartmentRows, type DepartmentRow } from "../breakdowns";
import { formatSignedPercent } from "../utils";
import { ChartCard, ChartEmptyState } from "./chart-primitives";

type DepartmentBreakdownCardProps = {
  departments: DashboardBreakdown[];
  categories: DashboardBreakdown[];
  periodLabel: string;
  /** Rótulo curto da base de comparação ("vs 4 semanas antes"). */
  comparisonLabel: string;
  isLoading: boolean;
};

function percent(value: number): string {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function ChangeTag({ change, comparisonLabel }: { change: number | null; comparisonLabel: string }) {
  if (change === null) return null;
  return (
    <span
      title={comparisonLabel}
      className={cn(
        "w-14 shrink-0 text-right text-[11px] font-medium tabular-nums",
        change >= 0 ? "text-emerald-400" : "text-destructive",
      )}
    >
      {formatSignedPercent(change)}
    </span>
  );
}

function Bar({ share, muted }: { share: number; muted?: boolean }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/50">
      <div
        className={cn("h-full rounded-full", "bg-[hsl(var(--chart-1))]", muted && "opacity-50")}
        style={{ width: `${Math.max(share * 100, 2)}%` }}
      />
    </div>
  );
}

function DepartmentItem({
  row,
  max,
  comparisonLabel,
}: {
  row: DepartmentRow;
  max: number;
  comparisonLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const expandable = row.categories.length > 1;

  return (
    <li>
      <button
        type="button"
        onClick={() => expandable && setOpen((value) => !value)}
        aria-expanded={expandable ? open : undefined}
        className={cn("w-full text-left", expandable ? "cursor-pointer" : "cursor-default")}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="flex min-w-0 items-center gap-1 text-sm text-foreground">
            <ChevronRight
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-90",
                !expandable && "invisible",
              )}
            />
            <span className="truncate" title={row.name}>
              {row.name}
            </span>
          </span>
          <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
            {formatCurrency(row.revenue)}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-3 pl-[18px]">
          <Bar share={row.revenue / max} />
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {percent(row.percentageOfTotal)}
          </span>
          <ChangeTag change={row.change} comparisonLabel={comparisonLabel} />
        </div>
      </button>

      {open && (
        <ul className="mt-3 flex flex-col gap-2.5 border-l border-border/60 pl-4 ml-[7px]">
          {row.categories.map((category) => (
            <li key={category.id ?? category.name}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="truncate text-muted-foreground" title={category.name}>
                  {category.name}
                </span>
                <span className="shrink-0 tabular-nums text-foreground">
                  {formatCurrency(category.revenue)}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <Bar share={category.revenue / max} muted />
                <span className="w-12 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                  {percent(category.percentageOfTotal)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * DepartmentBreakdownCard
 *
 * Faturamento por departamento, com a variação contra a base dos cards e as
 * principais categorias de cada um ao clicar.
 *
 * Substitui o card por categoria, que não se lia: com 59 categorias vendendo e a
 * maior com 6,8% (medido em 04/10/2026), a cauda agrupada em "Outros" ficava com
 * 62% e dominava o gráfico. Por departamento, os sete primeiros cobrem 91%. A
 * categoria continua a um clique, dentro do seu departamento.
 *
 * Um matiz só nas barras: a identidade está no nome ao lado.
 */
export function DepartmentBreakdownCard({
  departments,
  categories,
  periodLabel,
  comparisonLabel,
  isLoading,
}: DepartmentBreakdownCardProps) {
  const rows = useMemo(() => buildDepartmentRows(departments, categories), [departments, categories]);

  if (isLoading) {
    return <Skeleton className="h-[360px] rounded-xl" />;
  }

  const max = Math.max(...rows.map((row) => row.revenue), 1);

  return (
    <ChartCard
      title="Faturamento por departamento"
      description={`${periodLabel} · clique para ver as categorias`}
    >
      {rows.length === 0 ? (
        <ChartEmptyState message="Nenhuma venda no período selecionado." />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <DepartmentItem
              key={`${row.id ?? "demais"}-${row.name}`}
              row={row}
              max={max}
              comparisonLabel={comparisonLabel}
            />
          ))}
        </ul>
      )}
    </ChartCard>
  );
}

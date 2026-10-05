import type { ChampionStockAlert, DashboardBreakdown, DashboardChampion } from "./types";
import { growth } from "./utils";

/**
 * Regras de leitura das quebras e dos campeões do painel — fora dos componentes
 * para serem verificadas sem renderizar.
 */

/** Departamentos exibidos antes de juntar a cauda numa linha só. */
export const VISIBLE_DEPARTMENTS = 7;

/** Categorias abertas ao expandir um departamento. */
export const CATEGORIES_PER_DEPARTMENT = 5;

export type DepartmentRow = DashboardBreakdown & {
  /** Variação contra a base de comparação; `null` sem base (não vendeu lá). */
  change: number | null;
  /** Categorias do departamento, da maior para a menor. Vazio na linha "Demais". */
  categories: DashboardBreakdown[];
  /** Quantos departamentos a linha "Demais" junta; 0 nas linhas comuns. */
  groupedCount: number;
};

/**
 * Linhas do card de departamentos.
 *
 * Os sete primeiros aparecem um a um; o resto vira "Demais (n)". Medido em
 * 04/10/2026: 21 departamentos e os sete primeiros com 91% do faturamento — a
 * cauda fica com menos de 10%, contra os 62% que o "Outros" das categorias
 * concentrava.
 */
export function buildDepartmentRows(
  departments: DashboardBreakdown[],
  categories: DashboardBreakdown[],
  visible = VISIBLE_DEPARTMENTS,
): DepartmentRow[] {
  const withSales = departments.filter((department) => department.revenue > 0);
  const toRow = (department: DashboardBreakdown): DepartmentRow => ({
    ...department,
    change: growthOrNull(department.revenue, department.previousRevenue),
    categories: categories
      .filter((category) => category.parentId === department.id && category.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, CATEGORIES_PER_DEPARTMENT),
    groupedCount: 0,
  });

  // Juntar um só não economiza linha nenhuma: com oito, mostra os oito.
  if (withSales.length <= visible + 1) return withSales.map(toRow);

  const tail = withSales.slice(visible);
  const sum = (pick: (item: DashboardBreakdown) => number) =>
    tail.reduce((total, item) => total + pick(item), 0);
  const previous = sum((item) => item.previousRevenue ?? 0);

  return [
    ...withSales.slice(0, visible).map(toRow),
    {
      id: null,
      name: `Demais (${tail.length})`,
      revenue: sum((item) => item.revenue),
      profit: sum((item) => item.profit),
      salesCount: sum((item) => item.salesCount),
      itemsCount: sum((item) => item.itemsCount),
      percentageOfTotal: sum((item) => item.percentageOfTotal),
      previousRevenue: previous,
      change: growthOrNull(
        sum((item) => item.revenue),
        previous,
      ),
      categories: [],
      groupedCount: tail.length,
    },
  ];
}

/** Variação contra a base, ou `null` quando não há base: sair de zero não é percentual. */
function growthOrNull(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return growth(current, previous);
}

/**
 * Como a posição mudou contra a janela anterior: "novo" para quem não vendia,
 * subida/descida em posições, ou nada quando ficou igual.
 */
export function rankChange(
  champion: Pick<DashboardChampion, "rank" | "previousRank">,
): { kind: "new" } | { kind: "up" | "down"; positions: number } | null {
  if (champion.previousRank === null || champion.previousRank === undefined) return { kind: "new" };
  const delta = champion.previousRank - champion.rank;
  if (delta === 0) return null;
  return { kind: delta > 0 ? "up" : "down", positions: Math.abs(delta) };
}

/** Duração legível: "~6 dias", "~3 semanas", "+2 meses". */
export function formatCover(days: number): string {
  if (days < 1) return "menos de 1 dia";
  if (days < 21) return `~${Math.round(days)} ${Math.round(days) === 1 ? "dia" : "dias"}`;
  if (days < 60) return `~${Math.round(days / 7)} semanas`;
  return `+${Math.floor(days / 30)} meses`;
}

/** Texto do estoque de um campeão, na leitura da sua faixa. */
export function stockLabel(
  champion: Pick<DashboardChampion, "stock" | "daysOfCover" | "stockAlert">,
): string {
  const alert: ChampionStockAlert = champion.stockAlert;
  if (alert === "untracked") return "sem controle";
  if (alert === "out") return "Esgotado";
  const units = `${champion.stock} un`;
  if (champion.daysOfCover === null || champion.daysOfCover === undefined) return units;
  return `${units} · ${formatCover(champion.daysOfCover)}`;
}

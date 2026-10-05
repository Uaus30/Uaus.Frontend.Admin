import { describe, it, expect } from "vitest";
import { buildDepartmentRows, formatCover, rankChange, stockLabel } from "../breakdowns";
import type { DashboardBreakdown } from "../types";

function slice(id: number, revenue: number, extra: Partial<DashboardBreakdown> = {}): DashboardBreakdown {
  return {
    id,
    name: `Item ${id}`,
    revenue,
    profit: revenue / 2,
    salesCount: 1,
    itemsCount: 1,
    percentageOfTotal: revenue / 10,
    ...extra,
  };
}

describe("buildDepartmentRows", () => {
  it("mostra os sete primeiros e junta a cauda em Demais", () => {
    const departments = Array.from({ length: 10 }, (_, index) =>
      slice(index + 1, 100 - index * 5, { previousRevenue: 10 }),
    );

    const rows = buildDepartmentRows(departments, []);

    expect(rows).toHaveLength(8);
    expect(rows[7].name).toBe("Demais (3)");
    expect(rows[7].groupedCount).toBe(3);
    expect(rows[7].revenue).toBe(65 + 60 + 55);
    expect(rows[7].previousRevenue).toBe(30);
  });

  it("com oito, mostra os oito: juntar um só não poupa linha", () => {
    const departments = Array.from({ length: 8 }, (_, index) => slice(index + 1, 100 - index));
    expect(buildDepartmentRows(departments, []).map((row) => row.groupedCount)).toEqual(Array(8).fill(0));
  });

  it("deixa de fora departamento sem venda no período", () => {
    expect(buildDepartmentRows([slice(1, 50), slice(2, 0)], [])).toHaveLength(1);
  });

  it("calcula a variação contra a base, e nenhuma sem base", () => {
    const [comBase, semBase] = buildDepartmentRows(
      [slice(1, 120, { previousRevenue: 100 }), slice(2, 50, { previousRevenue: 0 })],
      [],
    );
    expect(comBase.change).toBe(20);
    expect(semBase.change).toBeNull();
  });

  it("abre as cinco maiores categorias do próprio departamento", () => {
    const categories = [
      ...Array.from({ length: 6 }, (_, index) => slice(10 + index, 10 + index, { parentId: 1 })),
      slice(99, 500, { parentId: 2 }),
    ];

    const [cozinha] = buildDepartmentRows([slice(1, 100), slice(2, 500)], categories).filter(
      (row) => row.id === 1,
    );

    expect(cozinha.categories.map((category) => category.id)).toEqual([15, 14, 13, 12, 11]);
  });
});

describe("rankChange", () => {
  it("marca o novato, quem subiu, quem caiu e quem ficou", () => {
    expect(rankChange({ rank: 3, previousRank: null })).toEqual({ kind: "new" });
    expect(rankChange({ rank: 2, previousRank: 5 })).toEqual({ kind: "up", positions: 3 });
    expect(rankChange({ rank: 6, previousRank: 4 })).toEqual({ kind: "down", positions: 2 });
    expect(rankChange({ rank: 1, previousRank: 1 })).toBeNull();
  });

  it("trata o campo omitido pela API como novato", () => {
    // O backend serializa com WhenWritingNull: sem posição anterior, o campo some.
    expect(rankChange({ rank: 1 })).toEqual({ kind: "new" });
  });
});

describe("estoque dos campeões", () => {
  it("escreve a duração na escala que faz sentido", () => {
    expect(formatCover(0.4)).toBe("menos de 1 dia");
    expect(formatCover(1)).toBe("~1 dia");
    expect(formatCover(6)).toBe("~6 dias");
    expect(formatCover(28)).toBe("~4 semanas");
    expect(formatCover(99.3)).toBe("+3 meses");
  });

  it("mostra unidades e duração, ou a leitura da faixa", () => {
    expect(stockLabel({ stock: 1, daysOfCover: 6, stockAlert: "critical" })).toBe("1 un · ~6 dias");
    expect(stockLabel({ stock: 0, daysOfCover: 0, stockAlert: "out" })).toBe("Esgotado");
    expect(stockLabel({ stock: 0, stockAlert: "untracked" })).toBe("sem controle");
    expect(stockLabel({ stock: 12, stockAlert: "ok" })).toBe("12 un");
  });
});

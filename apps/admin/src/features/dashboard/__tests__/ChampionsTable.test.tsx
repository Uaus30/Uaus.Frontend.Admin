import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChampionsTable } from "../components/ChampionsTable";
import type { DashboardChampion, DashboardChampions } from "../types";

const pote: DashboardChampion = {
  rank: 2,
  id: 1,
  productGroupId: 1,
  name: "POTE",
  categoryName: "Potes",
  quantitySold: 1,
  revenue: 10,
  profit: 6,
  marginPercentage: 60,
  profitShare: 16.7,
  stock: 300,
  minStock: 0,
  stockControlEnabled: true,
  daysOfCover: 900,
  hasOpenPurchase: false,
  stockAlert: "ok",
  isGroup: false,
  variations: [],
};

const sacola: DashboardChampion = {
  ...pote,
  rank: 1,
  id: 5,
  productGroupId: 4,
  name: "SACOLA",
  categoryName: "Sacolas",
  quantitySold: 5,
  profit: 30,
  stock: 3,
  isGroup: true,
  variations: [
    { id: 5, name: "SACOLA [FLORES]", quantitySold: 3, revenue: 30, profit: 18, stock: 2 },
    { id: 6, name: "SACOLA [XADREZ]", quantitySold: 2, revenue: 20, profit: 12, stock: 1 },
  ],
};

function renderTable(products: DashboardChampion[]) {
  const champions: DashboardChampions = {
    startDate: "2026-09-16T00:00:00",
    endDate: "2026-10-15T00:00:00",
    days: 30,
    totalRevenue: 60,
    totalProfit: 36,
    totalProducts: products.length,
    hasMore: false,
    products,
  };

  return render(
    <ChampionsTable
      champions={champions}
      take={10}
      canShowMore={false}
      canShowLess={false}
      showMore={vi.fn()}
      showLess={vi.fn()}
      isLoading={false}
      isFetching={false}
      isError={false}
    />,
  );
}

describe("ChampionsTable — produto julgado pelo total", () => {
  afterEach(cleanup);

  it("é uma linha só, que abre o que cada variação vendeu", () => {
    // "Vendeu 5 sacolas" (dono, 14/10/2026), com as estampas a um clique.
    renderTable([sacola, pote]);

    expect(screen.queryByText("SACOLA [FLORES]")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /2 variações venderam/ }));

    expect(screen.getByText("SACOLA [FLORES]")).toBeTruthy();
    expect(screen.getByText(/3 vendidos · R\$\s*18,00 de lucro · 2 em estoque/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /2 variações venderam/ }));
    expect(screen.queryByText("SACOLA [FLORES]")).toBeNull();
  });

  it("o produto comum não ganha o botão", () => {
    renderTable([pote]);

    expect(screen.queryByRole("button", { name: /variaç/ })).toBeNull();
  });
});

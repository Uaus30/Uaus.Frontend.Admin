import { render, screen, within } from "@testing-library/react";
import { Flame, Sparkles } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import type {
  ProductPerformanceItemDto,
  ProductPerformanceParametersDto,
} from "@workspace/api-client-react";
import { PerformanceComparison } from "../PerformanceComparison";
import { PerformanceSuggestions } from "../PerformanceSuggestions";
import { ProductRankingTable } from "../ProductRankingTable";

/**
 * As peças visuais dos dois rankings.
 *
 * O que está protegido aqui é o que a tela AFIRMA de relance: a leitura da
 * comparação (muito capital devolvendo pouco lucro), a coluna que só existe do
 * lado dos piores e o texto de cada ação. Nada disso quebra compilação quando
 * erra — a tela só passa a recomendar outra coisa.
 */

const PARAMETROS: ProductPerformanceParametersDto = {
  turnoverWeight: 0.3,
  marginWeight: 0.25,
  resultWeight: 0.25,
  consistencyWeight: 0.2,
  standoutScore: 70,
  steadyScore: 40,
  goodScore: 60,
  lowMarginThreshold: 30,
  healthyMarginThreshold: 40,
  shortCoverageDays: 21,
  excessCoverageDays: 365,
  newProductDays: 21,
  storeSellThrough: 23.17,
  storeMargin: 39.78,
  averageProfitPerProduct: 18.78,
};

function produto(overrides: Partial<ProductPerformanceItemDto>): ProductPerformanceItemDto {
  return {
    productId: 1,
    productGroupId: 1,
    productName: "CAMISETA DO BRASIL",
    barcode: "1",
    categoryName: "Vestuário",
    supplierName: "Shopee",
    rank: 1,
    units: 110,
    sales: 60,
    revenue: 2587.7,
    profit: 1084,
    margin: 41.89,
    price: 25,
    costPrice: 14,
    stock: 26,
    stockCost: 364,
    sellThrough: 80.88,
    coverageDays: 21.27,
    weeksWithSales: 11,
    frequency: "Constant",
    lastSaleAt: "2026-09-06T10:00:00",
    daysWithoutSelling: 1,
    daysInStore: 190,
    score: 100,
    scoreBreakdown: { turnover: 100, margin: 100, result: 100, consistency: 100 },
    class: "Standout",
    action: "Replicate",
    capitalAtRisk: 0,
    missedProfit: 0,
    ...overrides,
  };
}

describe("ProductRankingTable", () => {
  it("a coluna de capital em risco só existe do lado dos piores", () => {
    const { rerender } = render(
      <ProductRankingTable
        title="Os 100 melhores"
        description="por nota"
        icon={Sparkles}
        variant="best"
        products={[produto({})]}
        total={100}
        parameters={PARAMETROS}
        focusLabel={null}
        emptyMessage="vazio"
      />,
    );

    expect(screen.queryByText("Em risco")).toBeNull();

    rerender(
      <ProductRankingTable
        title="Os 100 piores"
        description="por capital em risco"
        icon={Flame}
        variant="worst"
        products={[
          produto({
            productId: 3,
            productName: "JARRA DE PLASTICO",
            class: "Weak",
            action: "Burn",
            score: 10.66,
            units: 1,
            margin: -428.57,
            profit: -60,
            sellThrough: 6.25,
            coverageDays: 1350,
            capitalAtRisk: 525.84,
            stockCost: 555,
          }),
        ]}
        total={100}
        parameters={PARAMETROS}
        focusLabel={null}
        emptyMessage="vazio"
      />,
    );

    expect(screen.getByText("Em risco")).toBeTruthy();
  });

  it("a linha diz em palavras o que o produto é e o que fazer com ele", () => {
    render(
      <ProductRankingTable
        title="Os 100 piores"
        description="por capital em risco"
        icon={Flame}
        variant="worst"
        products={[
          produto({
            productName: "CHAPEU PESCADOR",
            class: "Stalled",
            action: "Burn",
            score: 0,
            units: 0,
            stock: 9,
            coverageDays: null,
            capitalAtRisk: 104.4,
          }),
        ]}
        total={1}
        parameters={PARAMETROS}
        focusLabel={null}
        emptyMessage="vazio"
      />,
    );

    // Cor nunca sozinha: o rótulo em texto é o que sobrevive à impressão em
    // preto e branco e a quem não distingue verde de âmbar.
    expect(screen.getByText("Parado")).toBeTruthy();
    expect(screen.getByText("Queimar estoque")).toBeTruthy();
    // Sem venda no período não há cobertura a prever — "0 dias" diria "acaba
    // hoje" para um produto que não sai.
    expect(screen.getByText("sem giro")).toBeTruthy();
  });

  it("o recorte vazio explica em vez de mostrar tabela em branco", () => {
    render(
      <ProductRankingTable
        title="Os 100 melhores"
        description="por nota"
        icon={Sparkles}
        variant="best"
        products={[]}
        total={100}
        parameters={PARAMETROS}
        focusLabel="Queimar estoque"
        emptyMessage="Nenhum produto deste recorte entrou no ranking dos melhores."
      />,
    );

    expect(
      screen.getByText("Nenhum produto deste recorte entrou no ranking dos melhores."),
    ).toBeTruthy();
    expect(screen.getByText("Queimar estoque")).toBeTruthy();
  });
});

describe("PerformanceComparison", () => {
  it("diz em uma frase o que os dois percentuais significam juntos", () => {
    render(
      <PerformanceComparison
        size={100}
        comparison={{
          best: {
            products: 100,
            units: 2000,
            revenue: 15000,
            profit: 5992.54,
            margin: 40,
            stockCost: 7336.42,
            capitalAtRisk: 300,
            sellThrough: 55,
            averageScore: 91.99,
            profitShare: 64.21,
            stockCostShare: 23.98,
          },
          worst: {
            products: 100,
            units: 90,
            revenue: 1200,
            profit: 391.59,
            margin: 32,
            stockCost: 9463.26,
            capitalAtRisk: 6000,
            sellThrough: 2,
            averageScore: 26.28,
            profitShare: 4.2,
            stockCostShare: 30.94,
          },
        }}
      />,
    );

    expect(
      screen.getByText(/Ocupam 24% do capital em estoque e devolvem 64% do lucro/),
    ).toBeTruthy();
    expect(
      screen.getByText(/Ocupam 31% do capital em estoque e devolvem 4% do lucro/),
    ).toBeTruthy();
  });
});

describe("PerformanceSuggestions", () => {
  it("cada card mede uma coisa diferente, porque cada ação É uma coisa diferente", () => {
    const onSelect = vi.fn();

    render(
      <PerformanceSuggestions
        selected={null}
        onSelect={onSelect}
        suggestions={[
          { action: "RaisePrice", products: 23, amount: 330.47, revenue: 900, profit: 100, stockCost: 300 },
          { action: "Burn", products: 223, amount: 12732.83, revenue: 100, profit: 10, stockCost: 12732.83 },
          { action: "Restock", products: 0, amount: 0, revenue: 0, profit: 0, stockCost: 0 },
        ]}
      />,
    );

    const subir = screen.getByText("Subir preço").closest("div")?.parentElement as HTMLElement;
    expect(within(subir).getByText(/de lucro deixado na mesa/)).toBeTruthy();

    const queimar = screen.getByText("Queimar estoque").closest("div")?.parentElement as HTMLElement;
    expect(within(queimar).getByText(/de custo parado na prateleira/)).toBeTruthy();

    // Card sem produto não convida ao clique nem finge ter conteúdo.
    expect(screen.getByText("Nenhum produto pede esta decisão agora.")).toBeTruthy();
  });
});

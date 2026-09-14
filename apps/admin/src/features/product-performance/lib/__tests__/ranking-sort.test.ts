import { describe, expect, it } from "vitest";
import type { ProductPerformanceItemDto } from "@workspace/api-client-react";
import { direcaoInicial, ordenarRanking, proximaOrdem } from "../ranking-sort";

/**
 * A ordenação manual das tabelas de ranking.
 *
 * O que está protegido é o que quebra em silêncio: a estabilidade (empate que
 * reembaralha linhas sem motivo), as duas pontas da coluna "Dura" — que não são
 * número de dias — e a margem ausente, que não é 0%.
 */

function item(overrides: Partial<ProductPerformanceItemDto>): ProductPerformanceItemDto {
  return {
    productId: 1,
    productGroupId: 1,
    productName: "PRODUTO",
    barcode: "1",
    rank: 1,
    units: 10,
    sales: 5,
    revenue: 100,
    profit: 40,
    margin: 40,
    price: 10,
    costPrice: 6,
    stock: 10,
    stockCost: 60,
    sellThrough: 50,
    coverageDays: 90,
    weeksWithSales: 4,
    frequency: "Occasional",
    daysInStore: 200,
    score: 50,
    salesScore: 50,
    scoreBreakdown: { turnover: 50, margin: 50, result: 50, consistency: 50, capital: 50, liquidity: 50 },
    class: "Steady",
    action: "None",
    capitalAtRisk: 30,
    missedProfit: 0,
    ...overrides,
  };
}

const nomes = (lista: ProductPerformanceItemDto[]) => lista.map((x) => x.productName);

describe("ordenarRanking", () => {
  it("na nota crescente devolve do pior para o menos pior", () => {
    const lista = [
      item({ productName: "MEDIO", score: 16.9 }),
      item({ productName: "PIOR", score: 4.08 }),
      item({ productName: "MENOS PIOR", score: 38.2 }),
    ];

    expect(nomes(ordenarRanking(lista, { coluna: "nota", direcao: "asc" }))).toEqual([
      "PIOR",
      "MEDIO",
      "MENOS PIOR",
    ]);
  });

  it("preserva a ordem de origem no empate, nas duas direções", () => {
    // O servidor já desempatou estas três por capital em risco e por nome. Uma
    // ordenação instável desfaria esse trabalho a cada clique, e a lista pareceria
    // mudar sozinha sem nenhum número ter mudado.
    const lista = [
      item({ productName: "PRIMEIRO", score: 12 }),
      item({ productName: "SEGUNDO", score: 12 }),
      item({ productName: "TERCEIRO", score: 12 }),
    ];

    expect(nomes(ordenarRanking(lista, { coluna: "nota", direcao: "asc" }))).toEqual([
      "PRIMEIRO",
      "SEGUNDO",
      "TERCEIRO",
    ]);
    expect(nomes(ordenarRanking(lista, { coluna: "nota", direcao: "desc" }))).toEqual([
      "PRIMEIRO",
      "SEGUNDO",
      "TERCEIRO",
    ]);
  });

  it("em Dura, esgotado é zero e sem giro é o fim da fila", () => {
    // As duas pontas não são número de dias: esgotado já acabou, e o que não gira
    // não acaba nunca. Ordenar `null` como zero juntaria os dois extremos opostos.
    const lista = [
      item({ productName: "TRES MESES", stock: 10, coverageDays: 90 }),
      item({ productName: "SEM GIRO", stock: 10, coverageDays: null }),
      item({ productName: "ESGOTADO", stock: 0, coverageDays: null }),
    ];

    expect(nomes(ordenarRanking(lista, { coluna: "dura", direcao: "desc" }))).toEqual([
      "SEM GIRO",
      "TRES MESES",
      "ESGOTADO",
    ]);
  });

  it("dois sem giro não embaralham entre si", () => {
    // Subtrair Infinity de Infinity daria NaN, e o resultado passaria a depender
    // do motor de ordenação do navegador.
    const lista = [
      item({ productName: "PARADO A", stock: 5, coverageDays: null }),
      item({ productName: "PARADO B", stock: 9, coverageDays: null }),
    ];

    expect(nomes(ordenarRanking(lista, { coluna: "dura", direcao: "desc" }))).toEqual([
      "PARADO A",
      "PARADO B",
    ]);
  });

  it("em Margem, quem não vendeu ordena pela margem de entrada", () => {
    // Produto parado não tem margem realizada, e a célula mostra a de entrada:
    // R$ 20 de preço contra R$ 5 do último lote são 75%. Ordenar por
    // `item.margin` cru mandaria os dois parados para o zero.
    const lista = [
      item({ productName: "PARADO GORDO", units: 0, margin: 0, price: 20, costPrice: 5 }),
      item({ productName: "VENDEU APERTADO", units: 3, margin: 12 }),
      item({ productName: "PARADO MAGRO", units: 0, margin: 0, price: 20, costPrice: 16 }),
    ];

    expect(nomes(ordenarRanking(lista, { coluna: "margem", direcao: "desc" }))).toEqual([
      "PARADO GORDO",
      "PARADO MAGRO",
      "VENDEU APERTADO",
    ]);
  });

  it("margem inexistente dos dois lados vai para o fim nas duas direções", () => {
    // Não vendeu E não tem preço cadastrado: nem realizada nem de entrada. A
    // célula mostra "—", e tratá-la como 0% a misturaria com o empate.
    const lista = [
      item({ productName: "SEM PRECO", units: 0, margin: 0, price: 0, costPrice: 0 }),
      item({ productName: "PREJUIZO", units: 3, margin: -30 }),
      item({ productName: "SAUDAVEL", units: 3, margin: 45 }),
    ];

    expect(nomes(ordenarRanking(lista, { coluna: "margem", direcao: "desc" }))).toEqual([
      "SAUDAVEL",
      "PREJUIZO",
      "SEM PRECO",
    ]);
    expect(nomes(ordenarRanking(lista, { coluna: "margem", direcao: "asc" }))).toEqual([
      "PREJUIZO",
      "SAUDAVEL",
      "SEM PRECO",
    ]);
  });

  it("ordena produto pelo alfabeto do português, com acento no lugar certo", () => {
    const lista = [
      item({ productName: "ZINCO" }),
      item({ productName: "ÁGUA SANITARIA" }),
      item({ productName: "BALDE" }),
    ];

    expect(nomes(ordenarRanking(lista, { coluna: "produto", direcao: "asc" }))).toEqual([
      "ÁGUA SANITARIA",
      "BALDE",
      "ZINCO",
    ]);
  });

  it("não altera a lista recebida", () => {
    const lista = [item({ productName: "B", score: 10 }), item({ productName: "A", score: 90 })];

    ordenarRanking(lista, { coluna: "nota", direcao: "asc" });

    expect(nomes(lista)).toEqual(["B", "A"]);
  });
});

describe("direcaoInicial e proximaOrdem", () => {
  it("a nota abre para o lado que cada tabela responde", () => {
    expect(direcaoInicial("nota", true)).toBe("desc");
    expect(direcaoInicial("nota", false)).toBe("asc");

    // As outras abrem pela ponta interessante, igual nas duas tabelas.
    expect(direcaoInicial("risco", false)).toBe("desc");
    expect(direcaoInicial("produto", false)).toBe("asc");
  });

  it("clicar na coluna ativa inverte; clicar em outra abre na direção dela", () => {
    const piores = { coluna: "nota", direcao: "asc" } as const;

    expect(proximaOrdem(piores, "nota", false)).toEqual({ coluna: "nota", direcao: "desc" });
    expect(proximaOrdem(piores, "estoque", false)).toEqual({ coluna: "estoque", direcao: "desc" });
  });
});

import { describe, expect, it } from "vitest";
import { marginBand } from "@workspace/core";
import type { PurchaseDto } from "../../types";
import { derivePurchaseTotals, purchaseMarginPercent } from "../purchase-totals";

describe("derivePurchaseTotals", () => {
  it("deriva unitarios e percentual dos totais, como o backend", () => {
    // R$ 120 bruto e R$ 100 final em 3 unidades: 40,00 e 33,33 por unidade,
    // desconto de 16,67%. Os mesmos numeros do PurchaseServiceTests.
    expect(derivePurchaseTotals(3, 120, 100)).toEqual({
      unitGross: 40,
      unitFinal: 33.33,
      adjustmentPercent: -16.67,
    });
  });

  it("acrescimo sai positivo", () => {
    expect(derivePurchaseTotals(2, 100, 110).adjustmentPercent).toBe(10);
  });

  it("zera tudo sem quantidade ou sem bruto, em vez de dividir por zero", () => {
    expect(derivePurchaseTotals(0, 100, 100)).toEqual({ unitGross: 0, unitFinal: 0, adjustmentPercent: 0 });
    expect(derivePurchaseTotals(2, 0, 50)).toEqual({ unitGross: 0, unitFinal: 25, adjustmentPercent: 0 });
    expect(derivePurchaseTotals(Number.NaN, Number.NaN, Number.NaN)).toEqual({
      unitGross: 0,
      unitFinal: 0,
      adjustmentPercent: 0,
    });
  });
});

/**
 * A margem prevista da linha de Compras (13/09/2026).
 *
 * A coluna substituiu o "Total final": o total e a soma de um pedido cujo
 * tamanho varia, e R$ 1.500 ao lado de R$ 30 nao diz qual compra foi melhor.
 */
const compra: PurchaseDto = {
  id: 1,
  createdAt: "2026-09-13T10:00:00",
  updatedAt: null,
  supplierId: 1,
  supplierName: "Shopee",
  productName: "CANECA",
  purchaseDate: "2026-09-13T00:00:00",
  quantity: 10,
  grossTotal: 100,
  finalTotal: 100,
  unitGross: 10,
  unitFinal: 10,
  adjustmentPercent: 0,
  status: "InTransit",
  images: [],
  items: [],
  costSplitManual: false,
};

describe("purchaseMarginPercent", () => {
  it("usa o preco sugerido NA COMPRA, que e onde o preco de venda e decidido", () => {
    // Custo 10, preco 16,70: sobram 40,12% — a faixa que a loja pratica.
    expect(purchaseMarginPercent({ ...compra, suggestedPrice: 16.7 })).toBe(40.12);
    expect(marginBand(purchaseMarginPercent({ ...compra, suggestedPrice: 16.7 }))).toBe("healthy");
  });

  it("sem preco decidido, cai no preco que o produto ja tem", () => {
    // E o que a loja cobra hoje, e e contra ele que o custo recem-negociado se
    // compara. Sem isso a coluna ficaria vazia na maioria das reposicoes, onde o
    // preco nao muda e ninguem preenche o sugerido.
    expect(purchaseMarginPercent({ ...compra, productPrice: 20 })).toBe(50);
    // O sugerido manda quando existe: e a decisao mais recente.
    expect(purchaseMarginPercent({ ...compra, suggestedPrice: 12.5, productPrice: 20 })).toBe(20);
  });

  it("sem custo ou sem preco nao ha margem — e vazio nao e zero", () => {
    // Compra pendente anotada sem custo (o caso que derrubou a listagem em
    // 09/09/2026) e compra de produto novo sem preco decidido. Zero leria como
    // "vende no custo", que e uma afirmacao que ninguem fez.
    expect(purchaseMarginPercent({ ...compra, unitFinal: 0, suggestedPrice: 16.7 })).toBeNull();
    expect(purchaseMarginPercent(compra)).toBeNull();
    expect(marginBand(purchaseMarginPercent(compra))).toBeNull();
  });

  it("venda abaixo do custo da margem negativa, e ela e vermelha", () => {
    // Acontece: o fornecedor aumentou e o preco da etiqueta ficou para tras. A
    // linha tem que gritar, nao sumir.
    expect(purchaseMarginPercent({ ...compra, suggestedPrice: 8 })).toBe(-25);
    expect(marginBand(purchaseMarginPercent({ ...compra, suggestedPrice: 8 }))).toBe("low");
  });

  it("as tres faixas seguem a regra de toda tela que mostra margem", () => {
    // Verde a partir de 40%, amarelo de 30% a 40%, vermelho abaixo (`marginBand`).
    expect(marginBand(purchaseMarginPercent({ ...compra, suggestedPrice: 14.3 }))).toBe("tight");
    expect(marginBand(purchaseMarginPercent({ ...compra, suggestedPrice: 13 }))).toBe("low");
  });
});

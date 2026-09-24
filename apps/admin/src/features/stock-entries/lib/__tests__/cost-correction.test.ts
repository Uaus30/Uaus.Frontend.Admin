import { describe, expect, it } from "vitest";
import type {
  PurchaseEntryCostCorrectionDto,
  ReceivedPurchaseEntryItemDto,
} from "@workspace/api-client-react";
import {
  describeAffectedClosings,
  describeCostCorrectionImpact,
  describeCostCorrectionMargin,
  describeCostCorrectionResult,
  parseCorrectedCost,
} from "../cost-correction";

const item = {
  id: 1,
  productName: "JARRA [AZUL]",
  quantity: 22,
  availableQuantity: 14,
  unitCost: 37,
} as ReceivedPurchaseEntryItemDto;

const resultado: PurchaseEntryCostCorrectionDto = {
  entryId: 395,
  itemId: 1,
  productId: 10,
  previousUnitCost: 37,
  unitCost: 3.7,
  changed: true,
  saleItemsUpdated: 8,
  writeOffItemsUpdated: 0,
  affectedClosings: [],
};

const INVALIDO = { error: "Custo unitário inválido. Use só número, como 3,70." };

describe("parseCorrectedCost", () => {
  it("lê a vírgula como decimal", () => {
    expect(parseCorrectedCost("3,70")).toEqual({ value: 3.7 });
    expect(parseCorrectedCost("1234,5")).toEqual({ value: 1234.5 });
  });

  it("lê o PONTO como decimal — '3.70' não pode virar R$ 370,00", () => {
    // O parseAmount do core lê ponto como milhar. Na mesma aba, o CurrencyInput e
    // a Contagem Física aceitam ponto como decimal (revisão, 23/09/2026).
    expect(parseCorrectedCost("3.70")).toEqual({ value: 3.7 });
    expect(parseCorrectedCost("0.5")).toEqual({ value: 0.5 });
  });

  it("campo vazio NÃO vira custo zero", () => {
    // Apagar o campo e salvar zeraria o custo do lote e das vendas que o consumiram.
    expect(parseCorrectedCost("")).toEqual({ error: "Informe o custo unitário." });
    expect(parseCorrectedCost("   ")).toEqual({ error: "Informe o custo unitário." });
  });

  it("zero digitado é aceito (bonificação), negativo e texto não", () => {
    expect(parseCorrectedCost("0")).toEqual({ value: 0 });
    expect(parseCorrectedCost("-1")).toEqual(INVALIDO);
    expect(parseCorrectedCost("abc")).toEqual(INVALIDO);
  });

  it("sobra de texto é recusada, e não cortada", () => {
    expect(parseCorrectedCost("3,7abc")).toEqual(INVALIDO);
    expect(parseCorrectedCost("3 70")).toEqual(INVALIDO);
    expect(parseCorrectedCost("1.234,5")).toEqual(INVALIDO);
  });

  it("arredonda ao centavo", () => {
    expect(parseCorrectedCost("1,345")).toEqual({ value: 1.35 });
  });
});

describe("describeCostCorrectionImpact", () => {
  it("diz quantas unidades já saíram e que o lucro dessas vendas muda", () => {
    const texto = describeCostCorrectionImpact(item);

    expect(texto).toContain("As 8 unidades que já saíram");
    expect(texto).toContain("o lucro dessas vendas muda");
    expect(texto).toContain("A quantidade, o preço e o valor das vendas não mudam");
  });

  it("no singular e sem consumo", () => {
    expect(describeCostCorrectionImpact({ ...item, availableQuantity: 21 })).toContain(
      "A unidade que já saiu desta entrada (vendas e baixas) tem o custo refeito",
    );
    expect(describeCostCorrectionImpact({ ...item, availableQuantity: 22 })).toContain(
      "Nenhuma unidade desta entrada saiu ainda.",
    );
  });

  it("com compra, avisa que os totais pagos não mudam", () => {
    expect(describeCostCorrectionImpact(item, 26)).toContain("A compra #26 também não muda");
    expect(describeCostCorrectionImpact(item)).not.toContain("compra");
  });
});

describe("describeCostCorrectionResult", () => {
  it("diz de quanto para quanto e o que foi refeito", () => {
    const texto = describeCostCorrectionResult({ ...resultado, writeOffItemsUpdated: 1 });

    expect(texto).toMatch(/De R\$\s37,00 para R\$\s3,70 por unidade\./);
    expect(texto).toContain("Custo refeito em 8 itens de venda e 1 item de baixa.");
  });

  it("sem venda consumida, e sem mudança", () => {
    expect(describeCostCorrectionResult({ ...resultado, saleItemsUpdated: 0 })).toContain(
      "Nenhuma venda tinha consumido esta entrada.",
    );
    expect(describeCostCorrectionResult({ ...resultado, changed: false })).toBe(
      "O custo informado já era o gravado — nada mudou.",
    );
  });
});

describe("describeAffectedClosings", () => {
  it("é nulo sem fechamento afetado", () => {
    expect(describeAffectedClosings(resultado)).toBeNull();
  });

  it("nomeia o período de cada fechamento assinado", () => {
    const texto = describeAffectedClosings({
      ...resultado,
      affectedClosings: [{ id: 3, periodStart: "2026-08-01T00:00:00", periodEnd: "2026-08-31T00:00:00" }],
    });

    expect(texto).toBe(
      "O fechamento assinado de 01/08/2026 a 31/08/2026 continua com o custo antigo no CMV. Reabrir é decisão sua.",
    );
  });
});

describe("describeCostCorrectionMargin", () => {
  const pandeiro = { unitCost: 4.12, productPrice: 9.9 };

  it("a margem de agora e a corrigida, sobre o preço de venda do cadastro", () => {
    // (9,90 − 4,12) / 9,90 = 58,38% → (9,90 − 5,00) / 9,90 = 49,49%.
    expect(describeCostCorrectionMargin(pandeiro, 5)).toEqual({ price: 9.9, before: 58.38, after: 49.49 });
  });

  it("custo de agora zerado (a anomalia que se corrige) não vira 'de 100%': só a margem nova", () => {
    expect(describeCostCorrectionMargin({ ...pandeiro, unitCost: 0 }, 5)).toEqual({
      price: 9.9,
      before: null,
      after: 49.49,
    });
  });

  it("custo corrigido para zero (bonificação) ou produto sem preço: sem margem a mostrar", () => {
    expect(describeCostCorrectionMargin(pandeiro, 0)).toBeNull();
    expect(describeCostCorrectionMargin({ ...pandeiro, productPrice: 0 }, 5)).toBeNull();
  });

  it("custo acima do preço é prejuízo: margem negativa", () => {
    expect(describeCostCorrectionMargin(pandeiro, 12)?.after).toBe(-21.21);
  });
});

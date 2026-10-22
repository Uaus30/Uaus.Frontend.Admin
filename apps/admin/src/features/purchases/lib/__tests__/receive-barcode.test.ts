import { describe, expect, it } from "vitest";
import type { PurchaseDto } from "@workspace/api-client-react";
import { resolveBarcodeInput } from "@workspace/core";
import { barcodeChangesOf, receiveBarcodeProblem, receiveUnitCost } from "../receive-barcode";
import type { PurchaseFormItem } from "../../types";

const CODIGO_BALDE = resolveBarcodeInput("10").code as string;

function linha(extras: Partial<PurchaseFormItem>): PurchaseFormItem {
  return {
    productId: 10,
    name: "BALDE",
    barcode: CODIGO_BALDE,
    stock: 3,
    quantity: 2,
    grossTotal: 20,
    finalTotal: 20,
    ...extras,
  };
}

describe("barcodeChangesOf", () => {
  it("manda só o código que mudou, como foi digitado", () => {
    expect(barcodeChangesOf([linha({})], { 10: " 77 " })).toEqual([{ productId: 10, barcode: "77" }]);
  });

  it("campo vazio e o próprio código do cadastro não são troca", () => {
    expect(barcodeChangesOf([linha({})], { 10: "  " })).toBeUndefined();
    expect(barcodeChangesOf([linha({})], { 10: "10" })).toBeUndefined();
  });

  it("a linha sem cadastro (marca nova) tem o próprio campo e não entra aqui", () => {
    expect(barcodeChangesOf([linha({ productId: -5, barcode: null })], { [-5]: "77" })).toBeUndefined();
  });

  it("linha que saiu da conferência não leva a troca junto", () => {
    expect(barcodeChangesOf([linha({ productId: 11 })], { 10: "77" })).toBeUndefined();
  });

  it("linha com zero (não veio) não leva a troca — separaria o cadastro sem unidade nenhuma", () => {
    expect(barcodeChangesOf([linha({ quantity: 0 })], { 10: "77" })).toBeUndefined();
  });
});

describe("receiveBarcodeProblem", () => {
  it("código inválido é recusado com a mensagem do cadastro de produto", () => {
    expect(receiveBarcodeProblem([linha({})], { 10: "abc" })).toMatch(/^Código novo de BALDE: /);
  });

  it("o mesmo código novo em duas variações é recusado", () => {
    const itens = [linha({}), linha({ productId: 11, name: "BALDE [AZUL]", barcode: null })];
    expect(receiveBarcodeProblem(itens, { 10: "77", 11: "77" })).toMatch(/duas variações/);
  });

  it("sem troca, nada a dizer", () => {
    expect(receiveBarcodeProblem([linha({})], {})).toBeNull();
  });
});

describe("receiveUnitCost", () => {
  const compra = { unitFinal: 10 } as PurchaseDto;

  it("sem conferência, o unitário da compra", () => {
    expect(receiveUnitCost(compra, [linha({})])).toBe(10);
  });

  it("na conferência, o maior unitário entre as variações que vieram", () => {
    const itens = [
      linha({ quantity: 2, finalTotal: 20 }),
      linha({ productId: 11, quantity: 1, finalTotal: 35 }),
      linha({ productId: 12, quantity: 0, finalTotal: 0 }),
    ];
    expect(receiveUnitCost(compra, itens)).toBe(35);
  });
});

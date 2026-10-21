import { describe, expect, it } from "vitest";
import {
  conferencia,
  currentBrandProblem,
  isNewBrandRow,
  needsCurrentBrand,
  newBrandProblem,
  nextNewBrandKey,
  normalizeBrand,
  purchaseItemIdOf,
  receiveNewBrandProblem,
} from "../new-brand";
import type { PurchaseFormItem } from "../../types";

function linha(extras: Partial<PurchaseFormItem> = {}): PurchaseFormItem {
  return {
    productId: 10,
    name: "BALDE",
    barcode: "789",
    stock: 2,
    quantity: 1,
    grossTotal: 0,
    finalTotal: 0,
    ...extras,
  };
}

function marca(brand: string, extras: Partial<PurchaseFormItem> = {}): PurchaseFormItem {
  return linha({
    productId: -5,
    name: "",
    barcode: null,
    stock: 0,
    newBrand: brand,
    newBarcode: "",
    ...extras,
  });
}

describe("new-brand — a linha de marca nova da compra (fase 4)", () => {
  it("a linha de marca nova é a de id negativo, e o id do item da compra é o sinal trocado", () => {
    expect(isNewBrandRow(linha())).toBe(false);
    expect(isNewBrandRow(marca("MASTER"))).toBe(true);
    expect(purchaseItemIdOf(marca("MASTER", { productId: -42 }))).toBe(42);
    expect(purchaseItemIdOf(linha())).toBeNull();
  });

  it("a chave da linha criada agora não colide com a de item gravado", () => {
    const chave = nextNewBrandKey([linha(), marca("A", { productId: -7 })]);
    expect(chave).toBeLessThan(-1_000_000_000);
    expect(nextNewBrandKey([marca("B", { productId: chave })])).toBeLessThan(chave);
  });

  it("a marca é gravada em caixa alta e sem espaço nas pontas", () => {
    expect(normalizeBrand("  master ")).toBe("MASTER");
    expect(normalizeBrand(undefined)).toBe("");
  });

  it("na compra: marca obrigatória, sem repetir, e o código opcional pela regra do cadastro", () => {
    expect(newBrandProblem([linha(), marca("")])).toMatch(/Informe a marca/);
    expect(newBrandProblem([marca("vi"), marca("VI", { productId: -6 })])).toMatch(/já está na compra/);
    expect(newBrandProblem([marca("ORIGINAL")], ["original"])).toMatch(/já está na compra ou no produto/);
    // 12 dígitos é um EAN-13 que perdeu um dígito: recusado como no cadastro.
    expect(newBrandProblem([marca("VI", { newBarcode: "789123456789" })])).toMatch(/12 dígitos/);
    expect(newBrandProblem([marca("VI"), marca("MASTER", { productId: -6, newBarcode: "55" })])).toBeNull();
    // Linha zerada não conta: é "não comprei esta".
    expect(newBrandProblem([marca("", { quantity: 0 })])).toBeNull();
  });

  it("no recebimento: o código é obrigatório — bipado ou gerado", () => {
    expect(receiveNewBrandProblem([marca("VI")])).toMatch(/código de barras da marca VI/);
    expect(receiveNewBrandProblem([marca("VI", { newBarcode: "55" })])).toBeNull();
    expect(receiveNewBrandProblem([marca("VI", { generateBarcode: true })])).toBeNull();
    expect(receiveNewBrandProblem([marca("VI", { quantity: 0 })])).toBeNull();
    // Com "Gerar código" o código da compra não vai, e não pode travar quem gerou.
    expect(
      receiveNewBrandProblem([marca("VI", { newBarcode: "789123456789", generateBarcode: true })]),
    ).toBeNull();
  });

  it("o mesmo código em duas marcas novas é recusado, na compra e no recebimento", () => {
    // No recebimento a segunda cairia na primeira, como recompra (revisão de 21/10/2026).
    const duas = [marca("VI", { newBarcode: "55" }), marca("MASTER", { productId: -6, newBarcode: "55" })];
    expect(newBrandProblem(duas)).toMatch(/duas marcas novas/);
    expect(receiveNewBrandProblem(duas)).toMatch(/duas marcas novas/);
    // Com "Gerar código" o código do campo não vai, e não conta como repetido.
    expect(receiveNewBrandProblem([duas[0], { ...duas[1], generateBarcode: true }])).toBeNull();
  });

  it("a marca do cadastro atual só é pedida quando alguma marca nova vira cadastro", () => {
    // O código bipado é o do próprio produto simples: é recompra dele, e a marca
    // pedida seria ignorada.
    const simples = linha({ barcode: "789" });
    expect(needsCurrentBrand([simples, marca("VI", { newBarcode: "789" })])).toBe(false);
    expect(needsCurrentBrand([simples, marca("VI", { newBarcode: "55" })])).toBe(true);
    expect(needsCurrentBrand([simples, marca("VI", { newBarcode: "789", generateBarcode: true })])).toBe(
      true,
    );
    expect(needsCurrentBrand([simples, marca("VI", { quantity: 0 })])).toBe(false);
  });

  it("a marca do cadastro atual é obrigatória e diferente da marca nova", () => {
    expect(currentBrandProblem([marca("VI")], " ")).toMatch(/Informe a marca/);
    expect(currentBrandProblem([marca("VI")], "vi")).toMatch(/diferente da marca nova \(VI\)/);
    expect(currentBrandProblem([marca("VI")], "ORIGINAL")).toBeNull();
    // A VI é recompra do próprio cadastro (o código é o dele): ele É a VI, e só
    // a MASTER vira cadastro.
    const simples = linha({ barcode: "789" });
    expect(
      currentBrandProblem(
        [simples, marca("VI", { newBarcode: "789" }), marca("MASTER", { productId: -6, newBarcode: "55" })],
        "VI",
      ),
    ).toBeNull();
  });

  it("marca nova faz o recebimento ter conferência, mesmo sozinha", () => {
    expect(conferencia([linha()])).toBe(false);
    expect(conferencia([marca("VI")])).toBe(true);
    expect(conferencia([linha(), linha({ productId: 11 })])).toBe(true);
  });
});

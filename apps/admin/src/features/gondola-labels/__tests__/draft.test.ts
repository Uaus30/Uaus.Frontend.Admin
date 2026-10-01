import { describe, expect, it } from "vitest";
import { customPriceForPayload, fromDraftDto, isEmptyDraftPayload, toDraftPayload } from "../draft";
import { exactBarcodeMatches, scanFeedbackOf } from "../barcode-lookup";
import type { LabelDraftItem } from "../types";
import type { ProductPdvSearchDto } from "@workspace/api-client-react";

function item(patch?: Partial<LabelDraftItem>): LabelDraftItem {
  return {
    productId: 5,
    productName: "CANECA",
    catalogName: "CANECA",
    barcode: "7891234567895",
    priceInput: "12,50",
    catalogPrice: 12.5,
    labelType: 1,
    quantityInput: "1",
    ...patch,
  };
}

describe("customPriceForPayload", () => {
  it("preço igual ao do cadastro segue o cadastro", () => {
    expect(customPriceForPayload(item())).toBeNull();
    // 12.5 digitado com ponto é o mesmo preço.
    expect(customPriceForPayload(item({ priceInput: "12.50" }))).toBeNull();
  });

  it("preço editado vai arredondado ao centavo", () => {
    expect(customPriceForPayload(item({ priceInput: "9,99" }))).toBe(9.99);
    expect(customPriceForPayload(item({ priceInput: "1.234,5" }))).toBe(1234.5);
  });

  it("campo vazio ou zero (no meio da digitação) segue o cadastro, para o salvamento não falhar", () => {
    expect(customPriceForPayload(item({ priceInput: "" }))).toBeNull();
    expect(customPriceForPayload(item({ priceInput: "0" }))).toBeNull();
    expect(customPriceForPayload(item({ priceInput: "abc" }))).toBeNull();
  });
});

describe("toDraftPayload", () => {
  it("manda nome e preço só quando editados, e quantidade inválida como 1", () => {
    const payload = toDraftPayload(
      [item(), item({ productId: 6, productName: "COPO CURTO", catalogName: "COPO", quantityInput: "" })],
      "  Corredor 3 ",
    );

    expect(payload).toEqual({
      description: "Corredor 3",
      items: [
        { productId: 5, labelType: 1, quantity: 1, productName: null, price: null },
        { productId: 6, labelType: 1, quantity: 1, productName: "COPO CURTO", price: null },
      ],
    });
  });

  it("lista vazia e identificação em branco é o pedido que apaga o rascunho", () => {
    expect(isEmptyDraftPayload(toDraftPayload([], "   "))).toBe(true);
    expect(isEmptyDraftPayload(toDraftPayload([], "Corredor 3"))).toBe(false);
    expect(isEmptyDraftPayload(toDraftPayload([item()], ""))).toBe(false);
  });
});

describe("fromDraftDto", () => {
  it("sem rascunho, a tela fica vazia", () => {
    expect(fromDraftDto(null)).toEqual({ description: "", items: [] });
  });

  it("o que foi editado prevalece; o resto vem do cadastro de hoje", () => {
    const loaded = fromDraftDto({
      items: [
        {
          productId: 5,
          labelType: 3,
          quantity: 4,
          catalogName: "CANECA",
          catalogPrice: 13.9,
          customPrice: 7,
        },
        {
          productId: 6,
          labelType: "Normal",
          quantity: 1,
          catalogName: "COPO",
          catalogPrice: 5.49,
          customName: "COPO P",
        },
      ],
    });

    expect(loaded.description).toBe("");
    expect(loaded.items[0]).toMatchObject({
      productName: "CANECA",
      priceInput: "7,00",
      catalogPrice: 13.9,
      labelType: 3,
      quantityInput: "4",
      barcode: null,
    });
    expect(loaded.items[1]).toMatchObject({
      productName: "COPO P",
      catalogName: "COPO",
      priceInput: "5,49",
      labelType: 1,
    });
    // Ida e volta: remontado e salvo de novo, continua sem editar o que não foi editado.
    expect(toDraftPayload(loaded.items, "").items[1]).toMatchObject({ productName: "COPO P", price: null });
    expect(toDraftPayload(loaded.items, "").items[0]).toMatchObject({ productName: null, price: 7 });
  });
});

describe("exactBarcodeMatches / scanFeedbackOf", () => {
  const p = (id: number, barcode: string | null) =>
    ({ id, name: `P${id}`, barcode, price: 1 }) as ProductPdvSearchDto;

  it("só vale o código exato, sem espaço sobrando", () => {
    const results = [p(1, " 7891234567895 "), p(2, "17891234567895"), p(3, null)];
    expect(exactBarcodeMatches(results, "7891234567895").map((x) => x.id)).toEqual([1]);
    expect(exactBarcodeMatches(results, "  ")).toEqual([]);
  });

  it("o aviso diz o nome e as cópias", () => {
    expect(scanFeedbackOf({ kind: "added", name: "CANECA", copies: 1 })).toEqual({
      tone: "success",
      message: "CANECA adicionado à lista.",
    });
    expect(scanFeedbackOf({ kind: "added", name: "CANECA", copies: 3 }).message).toContain("3 cópias");
    expect(scanFeedbackOf({ kind: "not-found", code: "123" }).tone).toBe("warning");
    expect(scanFeedbackOf({ kind: "error", code: "123" }).tone).toBe("error");
  });
});

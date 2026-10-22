import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VariationBarcodeField } from "../VariationFields";
import type { VariationDraft } from "../../types";

/** Uma variação já gravada, no mínimo que o campo do código lê. */
function variacao(extras: Partial<VariationDraft> = {}): VariationDraft {
  return {
    key: "product-10",
    id: 10,
    barcode: "7891234567895",
    values: [],
    images: [],
    canDelete: true,
    ...extras,
  } as VariationDraft;
}

function campo() {
  return screen.getByLabelText("Código de barras") as HTMLInputElement;
}

describe("VariationBarcodeField — código com venda (fase 4; troca liberada em 22/10/2026)", () => {
  it("variação que já vendeu: o código se troca, e a dica diz que o antigo vira MARCA ANTERIOR", () => {
    render(
      <VariationBarcodeField
        variation={variacao({ hasSales: true })}
        updateVariationDraft={vi.fn()}
        compact={false}
      />,
    );

    expect(campo().readOnly).toBe(false);
    expect(campo().title).toMatch(/MARCA ANTERIOR/);
  });

  it("variação sem venda continua editável", () => {
    render(
      <VariationBarcodeField
        variation={variacao({ hasSales: false })}
        updateVariationDraft={vi.fn()}
        compact={false}
      />,
    );

    expect(campo().readOnly).toBe(false);
  });
});

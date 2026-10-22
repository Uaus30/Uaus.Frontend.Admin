import { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PurchaseVariationsGrid } from "../PurchaseVariationsGrid";
import type { PurchaseFormItem } from "../../types";

/**
 * O nome da variação nova (a marca da fase 4, o valor da grade da fase 5) é
 * gravado em caixa alta — como o `usePurchaseVariations.setNewBrand` faz. Até
 * 22/10/2026 o campo passava o texto cru, o estado voltava em maiúsculas
 * diferente do que estava no campo, e o React jogava o cursor para o fim a cada
 * letra digitada no meio (relato do dono: "bug reincidente").
 */
function Grade({ inicial }: { inicial: string }) {
  const [itens, setItens] = useState<PurchaseFormItem[]>([
    {
      productId: -1_000_000_001,
      name: "",
      barcode: null,
      stock: 0,
      quantity: 1,
      grossTotal: 0,
      finalTotal: 0,
      newBrand: inicial,
      newBarcode: "",
    },
  ]);
  return (
    <PurchaseVariationsGrid
      items={itens}
      costSplitManual={false}
      readOnly={false}
      loading={false}
      onQuantityChange={vi.fn()}
      onTotalChange={vi.fn()}
      onToggleManual={vi.fn()}
      // A mesma regravação do hook: caixa alta no estado.
      onBrandChange={(productId, campo, valor) =>
        setItens((atual) =>
          atual.map((item) =>
            item.productId === productId
              ? { ...item, [campo]: campo === "newBrand" ? valor.toUpperCase() : valor }
              : item,
          ),
        )
      }
      newRowLabel="Estampa"
    />
  );
}

const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;

/** Digita como o navegador: o texto entra com o cursor depois da letra, e só então vem o `input`. */
function digitar(input: HTMLInputElement, texto: string, cursor: number) {
  setValue.call(input, texto);
  input.setSelectionRange(cursor, cursor);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("PurchaseVariationsGrid — o cursor não pula para o fim (22/10/2026)", () => {
  afterEach(cleanup);

  it("digitar no meio do nome da variação deixa o cursor depois da letra", () => {
    render(<Grade inicial="FLORIDO" />);
    const input = screen.getByLabelText<HTMLInputElement>("Estampa da variação nova");

    // "FLOR|IDO" + "e" → "FLOREIDO", com o cursor entre o E e o I.
    digitar(input, "FLOReIDO", 5);

    expect(input.value).toBe("FLOREIDO");
    expect(input.selectionStart).toBe(5);

    // A letra seguinte entra no mesmo lugar, não no fim.
    digitar(input, "FLOREsIDO", 6);
    expect(input.value).toBe("FLORESIDO");
    expect(input.selectionStart).toBe(6);
  });
});

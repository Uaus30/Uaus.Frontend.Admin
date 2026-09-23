import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductListStockCount } from "../ProductListStockCount";
import type { useProductListStockCount } from "../../hooks/useProductListStockCount";

type State = ReturnType<typeof useProductListStockCount>;

/** O estado do hook com a modal aberta, no mínimo que o componente lê. */
function estado(extras: Partial<State> = {}): State {
  return {
    count: {
      open: true,
      setOpen: vi.fn(),
      form: { counted: "", supplierId: "", unitCost: "", notes: "" },
      updateForm: vi.fn(),
      openCount: vi.fn(),
      counted: null,
      countedIsValid: false,
      difference: null,
      isSaving: false,
      submit: vi.fn(),
    },
    suppliers: [],
    variationChoices: [],
    pickedVariationId: null,
    productName: "COPO",
    barcode: null,
    currentStock: null,
    ready: false,
    loadError: null,
    retryLoad: vi.fn(),
    openFor: vi.fn(),
    pickVariation: vi.fn(),
    ...extras,
  };
}

describe("ProductListStockCount", () => {
  it("grupo com mais de uma variação pede a variação antes de contar", () => {
    render(
      <ProductListStockCount
        state={estado({
          variationChoices: [
            { id: 986, name: "COPO [AZUL]", price: 9.9, stock: 3, status: "Active" },
            { id: 987, name: "COPO [VERDE]", price: 9.9, stock: 12, status: "Active" },
          ],
        })}
      />,
    );

    expect(screen.getByText("Escolha a variação que você contou")).toBeTruthy();
    expect((document.getElementById("contagem-fisica") as HTMLInputElement).disabled).toBe(true);
  });

  it("leitura do saldo que falhou diz o motivo e oferece tentar de novo", () => {
    const retryLoad = vi.fn();
    render(<ProductListStockCount state={estado({ loadError: "Produto não encontrado.", retryLoad })} />);

    expect(screen.getByRole("alert").textContent).toContain("Produto não encontrado.");
    fireEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));

    expect(retryLoad).toHaveBeenCalledOnce();
  });

  it("produto simples com o saldo lido não mostra escolha nem erro", () => {
    render(<ProductListStockCount state={estado({ ready: true, currentStock: 7 })} />);

    expect(screen.queryByText("Escolha a variação que você contou")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect((document.getElementById("contagem-fisica") as HTMLInputElement).disabled).toBe(false);
  });
});

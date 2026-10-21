import { createEvent, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PurchaseReceiveDialog } from "../PurchaseReceiveDialog";
import type { PurchaseDto, ReceiveForm } from "../../types";

/** Uma compra a caminho, com custo — o caso que o diálogo confirma. */
function compra(): PurchaseDto {
  return {
    id: 7,
    createdAt: "2026-09-12T10:00:00",
    supplierId: 1,
    supplierName: "Shopee",
    productId: 963,
    productGroupId: 805,
    productName: "SACOLA",
    purchaseDate: "2026-09-12T00:00:00",
    quantity: 20,
    grossTotal: 90,
    finalTotal: 90,
    unitGross: 4.5,
    unitFinal: 4.5,
    adjustmentPercent: 0,
    status: "InTransit",
    images: [],
    items: [],
    costSplitManual: false,
  } as unknown as PurchaseDto;
}

function formulario(): ReceiveForm {
  return {
    entryDate: "2026-09-23",
    invoiceNumber: "",
    notes: "",
    price: 9.9,
    items: [],
    finalTotal: 90,
  } as unknown as ReceiveForm;
}

function renderDialog(stockFrozen: boolean) {
  render(
    <PurchaseReceiveDialog
      purchase={compra()}
      form={formulario()}
      onChange={vi.fn()}
      onItemChange={vi.fn()}
      onAddItem={vi.fn()}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      onEditPurchase={vi.fn()}
      isSaving={false}
      stockFrozen={stockFrozen}
    />,
  );
}

describe("PurchaseReceiveDialog — conferência de estoque em andamento", () => {
  it("avisa e trava o confirmar: o servidor recusaria a entrada", () => {
    renderDialog(true);

    expect(screen.getByText(/conferência de estoque em andamento/i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("sem conferência, o confirmar segue liberado", () => {
    renderDialog(false);

    expect(screen.queryByText(/conferência de estoque em andamento/i)).toBeNull();
    expect(
      (screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });
});

describe("PurchaseReceiveDialog — marca nova (fase 4)", () => {
  function comMarcaNova(extras: Partial<ReceiveForm> = {}, simples = true) {
    const onBrandChange = vi.fn();
    const onConfirm = vi.fn();
    // A conferência tem a busca de produto ("veio uma variação que não estava no pedido").
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <PurchaseReceiveDialog
          purchase={
            { ...compra(), groupHasVariations: !simples, productBarcode: "7891234567895" } as PurchaseDto
          }
          form={
            {
              ...formulario(),
              currentBrand: "",
              items: [
                {
                  productId: 963,
                  name: "SACOLA",
                  barcode: "789",
                  stock: 2,
                  quantity: 10,
                  grossTotal: 45,
                  finalTotal: 45,
                },
                {
                  productId: -81,
                  name: "VI",
                  barcode: null,
                  stock: 0,
                  quantity: 10,
                  grossTotal: 45,
                  finalTotal: 45,
                  newBrand: "VI",
                  newBarcode: "",
                  generateBarcode: false,
                },
              ],
              ...extras,
            } as ReceiveForm
          }
          onChange={vi.fn()}
          onItemChange={vi.fn()}
          onBrandChange={onBrandChange}
          onAddItem={vi.fn()}
          onCancel={vi.fn()}
          onConfirm={onConfirm}
          onEditPurchase={vi.fn()}
          isSaving={false}
        />
      </QueryClientProvider>,
    );
    return { onBrandChange, onConfirm };
  }

  function confirmar() {
    return screen.getByRole("button", { name: /confirmar recebimento/i }) as HTMLButtonElement;
  }

  it("sem o código da marca nova o confirmar trava e diz o que falta", () => {
    comMarcaNova({}, false);

    expect(confirmar().disabled).toBe(true);
    expect(screen.getByText(/código de barras da marca VI/)).toBeTruthy();
  });

  it("'Gerar código' é um clique na linha", () => {
    const { onBrandChange } = comMarcaNova({}, false);

    fireEvent.click(screen.getByRole("button", { name: /gerar código/i }));

    expect(onBrandChange).toHaveBeenCalledWith(-81, "generateBarcode", true);
  });

  it("produto simples pede a marca do cadastro atual antes de receber", () => {
    comMarcaNova({
      items: [
        {
          productId: 963,
          name: "SACOLA",
          barcode: "789",
          stock: 2,
          quantity: 10,
          grossTotal: 45,
          finalTotal: 45,
        },
        {
          productId: -81,
          name: "VI",
          barcode: null,
          stock: 0,
          quantity: 10,
          grossTotal: 45,
          finalTotal: 45,
          newBrand: "VI",
          newBarcode: "55",
          generateBarcode: false,
        },
      ],
    });

    expect(screen.getByPlaceholderText("Ex: ORIGINAL")).toBeTruthy();
    expect(screen.getByText("Informe a marca do cadastro atual.")).toBeTruthy();
    expect(confirmar().disabled).toBe(true);
  });

  it("com código e marca atual, libera", () => {
    comMarcaNova({
      currentBrand: "ORIGINAL",
      items: [
        {
          productId: 963,
          name: "SACOLA",
          barcode: "789",
          stock: 2,
          quantity: 10,
          grossTotal: 45,
          finalTotal: 45,
        },
        {
          productId: -81,
          name: "VI",
          barcode: null,
          stock: 0,
          quantity: 10,
          grossTotal: 45,
          finalTotal: 45,
          newBrand: "VI",
          newBarcode: "55",
          generateBarcode: false,
        },
      ],
    });

    expect(confirmar().disabled).toBe(false);
  });

  it("recompra do próprio produto simples não pede a marca do cadastro atual", () => {
    // O código bipado é o da SACOLA: nada vira variação, e a marca seria ignorada.
    comMarcaNova({
      items: [
        {
          productId: 963,
          name: "SACOLA",
          barcode: "789",
          stock: 2,
          quantity: 10,
          grossTotal: 45,
          finalTotal: 45,
        },
        {
          productId: -81,
          name: "VI",
          barcode: null,
          stock: 0,
          quantity: 10,
          grossTotal: 45,
          finalTotal: 45,
          newBrand: "VI",
          newBarcode: "789",
          generateBarcode: false,
        },
      ],
    });

    expect(screen.queryByPlaceholderText("Ex: ORIGINAL")).toBeNull();
    expect(confirmar().disabled).toBe(false);
  });

  it("o Enter do leitor no código da marca nova não lança o recebimento", () => {
    // O bipe termina num Enter: com o código válido e a grade fechando, o envio
    // implícito do navegador lançaria a entrada antes de a conferência acabar.
    comMarcaNova({}, false);
    const campo = screen.getByPlaceholderText("Bipe o código");

    const evento = createEvent.keyDown(campo, { key: "Enter" });
    fireEvent(campo, evento);

    expect(evento.defaultPrevented).toBe(true);
  });
});

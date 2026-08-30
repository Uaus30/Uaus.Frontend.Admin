import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupplierDto } from "@workspace/api-client-react";
import { SimpleStockEntryModal } from "../SimpleStockEntryModal";
import type { SimpleEntryForm } from "../../hooks/useProductStockEntries";

const form: SimpleEntryForm = {
  supplierId: "10",
  entryDate: "2026-08-16",
  invoiceNumber: "",
  notes: "",
  quantity: 1,
  unitCost: 18.4,
  price: 39.9,
};

const suppliers = [{ id: 10, name: "Shopee" }] as SupplierDto[];

afterEach(() => cleanup());

describe("SimpleStockEntryModal", () => {
  it("não deixa o submit vazar para o formulário que a abriu", () => {
    // Regressão: a modal é aberta de dentro do formulário do produto (aba
    // Estoque da tela de detalhe). O portal do Radix a tira do form no DOM, mas
    // o React propaga o submit pela ÁRVORE DE COMPONENTES — e o handler de fora
    // disparava junto. Na tela, salvar a entrada gravava o produto (PUT em
    // ProductGroups e Products, com linha no histórico) e fechava tudo por cima
    // do lançamento, sem nada explicando o que aconteceu.
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const outerSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());

    render(
      <form onSubmit={outerSubmit}>
        <SimpleStockEntryModal
          open
          onOpenChange={vi.fn()}
          productName="ESMALTE RISQUÉ"
          barcode="7071374159673"
          suppliers={suppliers}
          form={form}
          onChange={vi.fn()}
          isSaving={false}
          onSubmit={onSubmit}
        />
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Salvar Entrada" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(outerSubmit).not.toHaveBeenCalled();
  });

  it("mostra o produto escolhido em vez de pedir a busca de novo", () => {
    render(
      <SimpleStockEntryModal
        open
        onOpenChange={vi.fn()}
        productName="ESMALTE RISQUÉ"
        barcode="7071374159673"
        suppliers={suppliers}
        form={form}
        onChange={vi.fn()}
        isSaving={false}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText("ESMALTE RISQUÉ")).toBeTruthy();
    expect(screen.getByText("7071374159673")).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Buscar produto/i)).toBeNull();
  });

  it("edita quantidade, custo e preço pelo campo correspondente", () => {
    const onChange = vi.fn();
    render(
      <SimpleStockEntryModal
        open
        onOpenChange={vi.fn()}
        productName="ESMALTE RISQUÉ"
        barcode={null}
        suppliers={suppliers}
        form={form}
        onChange={onChange}
        isSaving={false}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Quantidade recebida"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Custo unitário"), { target: { value: "20.5" } });
    fireEvent.change(screen.getByLabelText("Preço de venda"), { target: { value: "45" } });

    expect(onChange).toHaveBeenNthCalledWith(1, "quantity", 12);
    expect(onChange).toHaveBeenNthCalledWith(2, "unitCost", 20.5);
    expect(onChange).toHaveBeenNthCalledWith(3, "price", 45);
  });
});

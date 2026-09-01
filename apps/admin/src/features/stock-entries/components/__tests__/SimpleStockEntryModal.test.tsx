import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps, FormEvent } from "react";
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

function renderModal(overrides: Partial<ComponentProps<typeof SimpleStockEntryModal>> = {}) {
  const props: ComponentProps<typeof SimpleStockEntryModal> = {
    open: true,
    onOpenChange: vi.fn(),
    productName: "ESMALTE RISQUÉ",
    barcode: "7071374159673",
    currentStock: 7,
    suppliers,
    form,
    onChange: vi.fn(),
    isSaving: false,
    onSubmit: vi.fn(),
    ...overrides,
  };
  render(<SimpleStockEntryModal {...props} />);
  return props;
}

afterEach(() => cleanup());

describe("SimpleStockEntryModal", () => {
  it("não deixa o submit vazar para o formulário que a abriu", () => {
    // Regressão: a modal é aberta de dentro do formulário do produto (aba
    // Estoque da tela de detalhe). O portal do Radix a tira do form no DOM, mas
    // o React propaga o submit pela ÁRVORE DE COMPONENTES — e o handler de fora
    // disparava junto. Na tela, salvar a entrada gravava o produto (PUT em
    // ProductGroups e Products, com linha no histórico) e fechava tudo por cima
    // do lançamento, sem nada explicando o que aconteceu.
    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault());
    const outerSubmit = vi.fn((e: FormEvent) => e.preventDefault());

    render(
      <form onSubmit={outerSubmit}>
        <SimpleStockEntryModal
          open
          onOpenChange={vi.fn()}
          productName="ESMALTE RISQUÉ"
          barcode="7071374159673"
          currentStock={7}
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

  it("mostra o produto escolhido e a prévia do estoque em vez de pedir a busca de novo", () => {
    renderModal();

    expect(screen.getByText("ESMALTE RISQUÉ")).toBeTruthy();
    expect(screen.getByText("7071374159673")).toBeTruthy();
    // Estoque 7 recebendo 1: a prévia diz onde o saldo vai parar.
    expect(screen.getByText("7 → 8")).toBeTruthy();
    expect(screen.queryByPlaceholderText(/Buscar produto/i)).toBeNull();
  });

  it("edita a quantidade sem trava — limpar o campo não volta para 1", () => {
    // Regressão de UX: o `Math.max(1, ...)` no onChange devolvia 1 a cada
    // backspace e o operador não conseguia digitar "25" começando do vazio.
    const { onChange } = renderModal();

    fireEvent.change(screen.getByLabelText("Quantidade recebida"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Quantidade recebida"), { target: { value: "" } });

    expect(onChange).toHaveBeenNthCalledWith(1, "quantity", 12);
    expect(onChange).toHaveBeenNthCalledWith(2, "quantity", 0);
  });

  it("edita custo e preço pelos campos de moeda com vírgula", () => {
    // Os campos são o CurrencyInput do admin: fora de foco mostram "R$ 18,40" e
    // entregam o número no blur — o type=number antigo exigia ponto decimal.
    const { onChange } = renderModal();

    const custo = screen.getByDisplayValue("R$ 18,40");
    fireEvent.focus(custo);
    fireEvent.change(screen.getByDisplayValue("18,4"), { target: { value: "20,5" } });
    fireEvent.blur(screen.getByDisplayValue("20,5"));

    expect(onChange).toHaveBeenCalledWith("unitCost", 20.5);
  });

  it("avisa quando o preço de venda está abaixo do custo", () => {
    renderModal({ form: { ...form, unitCost: 50, price: 39.9 } });

    expect(screen.getByText(/abaixo do custo/i)).toBeTruthy();
  });
});

import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getProductById: vi.fn() }));

vi.mock("@/services/products.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/products.service")>()),
  getProductById: mocks.getProductById,
}));

const { ProductPricing } = await import("../ProductPricing");
const { ProductMarginHint } = await import("../ProductMarginHint");

type HarnessProps = {
  id?: number | null;
  price?: number;
  hasVariations?: boolean;
  purchaseContext?: { purchaseId: number; unitCost: number } | null;
};

/** Preço com estado de verdade: o blur do campo tem que chegar ao formulário. */
function Harness({ id = 12, price = 9.9, hasVariations = false, purchaseContext = null }: HarnessProps) {
  const [productEditor, setProductEditor] = useState({ id, price, status: "1" });
  const editor = {
    form: { hasVariations },
    productEditor,
    setProductEditor,
    selectableStatusOptions: [{ id: 1, name: "Ativo" }],
    purchaseContext,
  } as unknown as Parameters<typeof ProductPricing>[0]["editor"];

  return <ProductPricing editor={editor} validationErrors={{}} setValidationErrors={vi.fn()} />;
}

function renderPricing(props: HarnessProps = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

/** O número da margem, como a tela o escreve — o `<span>` colorido do rótulo. */
const margem = () => screen.getByText(/^Margem:/).querySelector("span") as HTMLElement;
const campoDoPreco = () => document.getElementById("input-price") as HTMLInputElement;

describe("ProductPricing — margem abaixo do preço de venda", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mostra a margem do preço sobre o último custo, na cor da faixa", async () => {
    mocks.getProductById.mockResolvedValue({ id: 12, costPrice: 4.12, stock: 10 });
    renderPricing();

    // (9,90 − 4,12) / 9,90 = 58,38% → verde, a partir de 40%.
    await waitFor(() => expect(margem().textContent).toBe("58,38%"));
    expect(margem().className).toContain("text-emerald-600");
    expect(mocks.getProductById).toHaveBeenCalledWith(12);
  });

  it("recalcula enquanto se digita, sem esperar sair do campo, e mantém depois do blur", async () => {
    mocks.getProductById.mockResolvedValue({ id: 12, costPrice: 4.12, stock: 10 });
    renderPricing();
    await waitFor(() => expect(margem().textContent).toBe("58,38%"));

    fireEvent.focus(campoDoPreco());
    fireEvent.change(campoDoPreco(), { target: { value: "5" } });
    // (5 − 4,12) / 5 = 17,60% → vermelho, abaixo de 30%.
    expect(margem().textContent).toBe("17,60%");
    expect(margem().className).toContain("text-red-600");

    fireEvent.change(campoDoPreco(), { target: { value: "6,5" } });
    // (6,50 − 4,12) / 6,50 = 36,62% → amarelo, de 30% a 40%.
    expect(margem().textContent).toBe("36,62%");
    expect(margem().className).toContain("text-amber-600");

    // Saindo do campo, o valor vai para o formulário e a margem continua a mesma.
    fireEvent.blur(campoDoPreco());
    expect(campoDoPreco().value).toContain("6,50");
    expect(margem().textContent).toBe("36,62%");
  });

  it("cadastro novo, ainda sem id: sem custo, sem margem e sem consulta", () => {
    renderPricing({ id: null });

    expect(screen.queryByText(/^Margem:/)).toBeNull();
    expect(mocks.getProductById).not.toHaveBeenCalled();
  });

  it("cadastro novo vindo de compra: a margem usa o custo da compra, e diz que é dele", () => {
    // O "Último custo" mostra "-" até a entrada existir; sem a compra, a margem
    // sumia justo onde o preço está sendo decidido.
    renderPricing({ id: null, price: 7.5, purchaseContext: { purchaseId: 37, unitCost: 4.5 } });

    // (7,50 − 4,50) / 7,50 = 40,00% → verde.
    expect(margem().textContent).toBe("40,00%");
    expect(margem().className).toContain("text-emerald-600");
    expect(screen.getByText(/^Margem:/).textContent).toContain("sobre o custo da compra #37 (R$");
    expect(mocks.getProductById).not.toHaveBeenCalled();
  });

  it("some no grupo com variações, como preço e status", () => {
    renderPricing({ hasVariations: true });

    expect(screen.queryByText(/Preço de venda/)).toBeNull();
    expect(mocks.getProductById).not.toHaveBeenCalled();
  });
});

describe("ProductMarginHint", () => {
  it("sem custo não mostra nada: margem sem custo seria um 100% enganoso", () => {
    const { container } = render(<ProductMarginHint base={null} price={10} />);
    expect(container.textContent).toBe("");
  });

  it("com custo e sem preço, '—' apagado — e não uma margem inventada", () => {
    render(<ProductMarginHint base={{ cost: 4.12, purchaseId: null }} price={0} />);

    expect(margem().textContent).toBe("—");
    expect(margem().className).toContain("text-muted-foreground");
  });

  it("preço abaixo do custo é prejuízo: margem negativa, em vermelho", () => {
    render(<ProductMarginHint base={{ cost: 4, purchaseId: null }} price={3} />);

    expect(margem().textContent).toBe("-33,33%");
    expect(margem().className).toContain("text-red-600");
    // Custo da última entrada não precisa dizer de onde veio: o campo está logo acima.
    expect(screen.getByText(/^Margem:/).textContent).toBe("Margem: -33,33%");
  });
});

import React, { useState } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getProductsPage: vi.fn() }));

vi.mock("@/services/products.service", () => ({ getProductsPage: mocks.getProductsPage }));

const { usePurchaseVariations } = await import("../usePurchaseVariations");
const { emptyPurchaseForm } = await import("../usePurchaseForm");

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Um cadastro do grupo, como a API o devolve. */
function produto(id: number, grades: Array<{ gradeType: string; value: string }> = []) {
  return {
    id,
    name: "BALDE 12L",
    displayName: grades.length ? `BALDE 12L [${grades.map((g) => g.value).join(", ")}]` : "BALDE 12L",
    barcode: `789${id}`,
    stock: 1,
    status: "Active",
    variationValues: grades,
  };
}

type Form = ReturnType<typeof emptyPurchaseForm>;

/** O hook com o formulário de verdade em volta, como a tela o usa. */
function renderVariations(productId: number | null, extras: Partial<Form> = {}) {
  return renderHook(
    () => {
      const [form, setForm] = useState<Form>({
        ...emptyPurchaseForm(),
        productId,
        productGroupId: 1,
        quantity: 2,
        ...extras,
      });
      const variations = usePurchaseVariations({ form, setForm, onEdit: vi.fn() });
      return { form, variations };
    },
    { wrapper: createWrapper() },
  );
}

describe("usePurchaseVariations — marca nova (fase 4)", () => {
  beforeEach(() => mocks.getProductsPage.mockReset());

  it("produto simples: a marca nova vira uma grade com o cadastro atual e a linha nova", async () => {
    mocks.getProductsPage.mockResolvedValue({ data: [produto(10)], total: 1 });
    const { result } = renderVariations(10);
    await waitFor(() => expect(result.current.variations.canAddBrand).toBe(true));
    expect(result.current.variations.hasGrid).toBe(false);

    act(() => result.current.variations.addNewBrand());

    expect(result.current.variations.hasGrid).toBe(true);
    const [atual, nova] = result.current.form.items;
    expect(atual).toMatchObject({ productId: 10, quantity: 2 });
    expect(nova.productId).toBeLessThan(0);
    // A quantidade do cabeçalho é a soma da grade.
    expect(result.current.form.quantity).toBe(3);

    act(() => result.current.variations.setNewBrand(nova.productId, "newBrand", "master"));
    expect(result.current.form.items[1].newBrand).toBe("MASTER");
  });

  it("tirar a única marca nova devolve o produto simples, com a quantidade no campo", async () => {
    mocks.getProductsPage.mockResolvedValue({ data: [produto(10)], total: 1 });
    const { result } = renderVariations(10);
    await waitFor(() => expect(result.current.variations.canAddBrand).toBe(true));
    act(() => result.current.variations.addNewBrand());
    const nova = result.current.form.items[1];

    act(() => result.current.variations.removeNewBrand(nova.productId));

    expect(result.current.form.items).toEqual([]);
    expect(result.current.variations.hasGrid).toBe(false);
    expect(result.current.form.quantity).toBe(2);
  });

  it("compra gravada com a marca nova: tirá-la devolve o produto ao cabeçalho e os totais à soma do que ficou", async () => {
    // REGRESSÃO (revisão de 21/10/2026): com dois itens o servidor grava a
    // compra sem produto no cabeçalho. Tirar a marca nova deixava o formulário
    // sem produto e sem grade — a compra virava "produto ainda não cadastrado",
    // e em custo manual o total de A ficava com o custo da marca nova dentro.
    mocks.getProductsPage.mockResolvedValue({ data: [produto(10)], total: 1 });
    const { result } = renderVariations(null, {
      quantity: 8,
      grossTotal: 80,
      finalTotal: 80,
      costSplitManual: true,
      items: [
        {
          productId: 10,
          name: "BALDE 12L",
          barcode: "78910",
          stock: 1,
          quantity: 5,
          grossTotal: 50,
          finalTotal: 50,
        },
        {
          productId: -81,
          name: "MASTER",
          barcode: null,
          stock: 0,
          quantity: 3,
          grossTotal: 30,
          finalTotal: 30,
          newBrand: "MASTER",
          newBarcode: "",
        },
      ],
    });
    await waitFor(() => expect(result.current.variations.variations).toHaveLength(1));

    act(() => result.current.variations.removeNewBrand(-81));

    expect(result.current.form).toMatchObject({
      productId: 10,
      items: [],
      quantity: 5,
      grossTotal: 50,
      finalTotal: 50,
      costSplitManual: false,
    });
  });

  it("produto com variações só de Marca aceita marca nova; com Cor, não", async () => {
    mocks.getProductsPage.mockResolvedValue({
      data: [
        produto(20, [{ gradeType: "Brand", value: "ORIGINAL" }]),
        produto(21, [{ gradeType: "Brand", value: "MASTER" }]),
      ],
      total: 2,
    });
    const marcas = renderVariations(20);
    await waitFor(() => expect(marcas.result.current.variations.canAddBrand).toBe(true));
    expect(marcas.result.current.variations.existingBrands).toEqual(["MASTER", "ORIGINAL"]);

    mocks.getProductsPage.mockResolvedValue({
      data: [
        produto(30, [{ gradeType: "Color", value: "AZUL" }]),
        produto(31, [{ gradeType: "Color", value: "VERDE" }]),
      ],
      total: 2,
    });
    const cores = renderVariations(30);
    await waitFor(() => expect(cores.result.current.variations.variations).toHaveLength(2));
    expect(cores.result.current.variations.canAddBrand).toBe(false);
  });
});

import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CategoryDto, PurchaseDto, SupplierDto } from "@workspace/api-client-react";

/**
 * O preço sugerido da compra e as instruções de recebimento (22/10/2026):
 * reposição nasce com o preço ATUAL do produto, nada passa do teto de R$ 30,
 * margem negativa pergunta antes de gravar, e o recado para quem recebe vai no
 * corpo da compra.
 */

const mocks = vi.hoisted(() => ({
  createPurchase: vi.fn(),
  updatePurchase: vi.fn(),
  getProductGroupById: vi.fn(),
  getProductGroupImages: vi.fn(),
  getProductsPage: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  createPurchase: mocks.createPurchase,
  updatePurchase: mocks.updatePurchase,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@/services/images.service", () => ({
  createImageFromFile: vi.fn(),
  downloadWebImageAsFile: vi.fn(),
}));

vi.mock("@/services/products.service", () => ({
  getProductsPage: mocks.getProductsPage,
  getProductGroupById: mocks.getProductGroupById,
  getProductGroupImages: mocks.getProductGroupImages,
}));

const { usePurchaseForm } = await import("../usePurchaseForm");

const CATEGORIAS = [{ id: 7, departmentId: 4, name: "Canecas" }] as unknown as CategoryDto[];
const FORNECEDORES = [{ id: 1, name: "Shopee", isMarketplace: false }] as unknown as SupplierDto[];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

function renderForm() {
  return renderHook(
    () =>
      usePurchaseForm({
        onSaved: vi.fn().mockResolvedValue(undefined),
        suppliers: FORNECEDORES,
        categories: CATEGORIAS,
      }),
    { wrapper: createWrapper() },
  );
}

/** Variações do grupo 5, como a página de produtos as devolve. */
function variacoes(...precos: number[]) {
  return {
    data: precos.map((preco, indice) => ({
      id: 41 + indice,
      productGroupId: 5,
      name: "CANECO",
      displayName: `CANECO [${indice}]`,
      barcode: null,
      stock: 1,
      status: "Active",
      price: preco,
      variationValues: [{ gradeType: "Brand", value: String(indice) }],
    })),
    total: precos.length,
  };
}

function reposicao(result: { current: ReturnType<typeof usePurchaseForm> }, productPrice: number) {
  act(() =>
    result.current.openForRestock({
      productId: 41,
      productGroupId: 5,
      productName: "CANECO",
      productBarcode: null,
      productPrice,
      supplierId: 1,
      quantity: 2,
    }),
  );
}

/** Produto novo, pronto para gravar, com o custo pedido. */
function produtoNovo(
  result: { current: ReturnType<typeof usePurchaseForm> },
  quantidade: number,
  total: number,
) {
  act(() => result.current.openNew());
  act(() => {
    result.current.update("supplierId", "1");
    result.current.update("categoryId", "7");
    result.current.update("productName", "CANECA");
    result.current.update("quantity", quantidade);
    result.current.update("grossTotal", total);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.createPurchase.mockResolvedValue({ id: 1 } as PurchaseDto);
  mocks.updatePurchase.mockResolvedValue({ id: 1 } as PurchaseDto);
  mocks.getProductGroupById.mockResolvedValue({ id: 5, categoryId: 7 });
  mocks.getProductGroupImages.mockResolvedValue([]);
  mocks.getProductsPage.mockResolvedValue({ data: [], total: 0 });
});

describe("preço sugerido da reposição (22/10/2026)", () => {
  it("nasce com o preço ATUAL do produto, e não com a margem sobre o custo", async () => {
    mocks.getProductsPage.mockResolvedValue(variacoes(12.9));
    const { result } = renderForm();

    reposicao(result, 12.9);
    act(() => result.current.setGrossTotal(20));

    await waitFor(() => expect(result.current.form.suggestedPrice).toBe(12.9));
    // A margem de 40% sobre custo 10 daria 16,70 — e trocaria a etiqueta.
    expect(result.current.form.suggestedPrice).not.toBe(16.7);
  });

  it("variações com preços diferentes nascem em branco — cada uma mantém o seu", async () => {
    mocks.getProductsPage.mockResolvedValue(variacoes(20, 25));
    const { result } = renderForm();

    reposicao(result, 20);

    await waitFor(() => expect(result.current.groupPrices).toEqual([20, 25]));
    expect(result.current.form.suggestedPrice).toBe(0);
  });
});

describe("reposição com o preço não mexido vai em branco (revisão de 22/10/2026)", () => {
  it("grava nulo — o recebimento usa o preço ATUAL de então, e não o do dia da compra", async () => {
    mocks.getProductsPage.mockResolvedValue(variacoes(12.9));
    const { result } = renderForm();
    reposicao(result, 12.9);
    act(() => result.current.setGrossTotal(20));
    await waitFor(() => expect(result.current.form.suggestedPrice).toBe(12.9));
    await waitFor(() => expect(result.current.loadingGroup).toBe(false));

    await act(async () => result.current.submit());

    await waitFor(() =>
      expect(mocks.createPurchase).toHaveBeenCalledWith(expect.objectContaining({ suggestedPrice: null })),
    );
  });

  it("o preço digitado na reposição é decisão, e vai no corpo", async () => {
    mocks.getProductsPage.mockResolvedValue(variacoes(12.9));
    const { result } = renderForm();
    reposicao(result, 12.9);
    act(() => result.current.setGrossTotal(20));
    await waitFor(() => expect(result.current.loadingGroup).toBe(false));
    act(() => result.current.update("suggestedPrice", 14.9));

    await act(async () => result.current.submit());

    await waitFor(() =>
      expect(mocks.createPurchase).toHaveBeenCalledWith(expect.objectContaining({ suggestedPrice: 14.9 })),
    );
  });
});

describe("teto de R$ 30 (22/10/2026)", () => {
  it("a sugestão pela margem para no teto", async () => {
    const { result } = renderForm();

    produtoNovo(result, 1, 20);

    // Custo 20 pede 33,40 para 40% de margem; a loja não vende acima de 30.
    await waitFor(() => expect(result.current.form.suggestedPrice).toBe(30));
  });

  it("preço digitado acima do teto não vai à rede", async () => {
    const { result } = renderForm();
    produtoNovo(result, 1, 10);
    act(() => result.current.update("suggestedPrice", 31));

    await act(async () => result.current.submit());

    expect(mocks.createPurchase).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: expect.stringMatching(/teto da loja/) }),
    );
  });
});

describe("margem negativa pergunta antes (22/10/2026)", () => {
  it("custo acima do preço abre a confirmação, e só confirmando grava", async () => {
    const { result } = renderForm();
    // Custo 35 por unidade: o sugerido para em 30, abaixo do custo.
    produtoNovo(result, 1, 35);
    await waitFor(() => expect(result.current.form.suggestedPrice).toBe(30));

    await act(async () => result.current.submit());
    expect(result.current.belowCostOpen).toBe(true);
    expect(mocks.createPurchase).not.toHaveBeenCalled();

    await act(async () => result.current.confirmBelowCost());
    await waitFor(() =>
      expect(mocks.createPurchase).toHaveBeenCalledWith(expect.objectContaining({ suggestedPrice: 30 })),
    );
    expect(result.current.belowCostOpen).toBe(false);
  });

  it("confirmar depois de revisar não grava — o diálogo ainda está saindo da tela", async () => {
    const { result } = renderForm();
    produtoNovo(result, 1, 35);
    await waitFor(() => expect(result.current.form.suggestedPrice).toBe(30));
    await act(async () => result.current.submit());

    act(() => result.current.cancelBelowCost());
    await act(async () => result.current.confirmBelowCost());

    expect(mocks.createPurchase).not.toHaveBeenCalled();
  });

  it("revisar o preço fecha a pergunta sem gravar", async () => {
    const { result } = renderForm();
    produtoNovo(result, 1, 35);
    await waitFor(() => expect(result.current.form.suggestedPrice).toBe(30));
    await act(async () => result.current.submit());

    act(() => result.current.cancelBelowCost());

    expect(result.current.belowCostOpen).toBe(false);
    expect(mocks.createPurchase).not.toHaveBeenCalled();
  });
});

describe("instruções de recebimento (22/10/2026)", () => {
  it("vão no corpo sem espaço nas pontas, e em branco viram nulo", async () => {
    const { result } = renderForm();
    produtoNovo(result, 2, 10);
    act(() => result.current.update("receivingInstructions", "  Vender avulso  "));

    await act(async () => result.current.submit());
    await waitFor(() =>
      expect(mocks.createPurchase).toHaveBeenCalledWith(
        expect.objectContaining({ receivingInstructions: "Vender avulso" }),
      ),
    );

    produtoNovo(result, 2, 10);
    act(() => result.current.update("receivingInstructions", "   "));
    await act(async () => result.current.submit());
    await waitFor(() =>
      expect(mocks.createPurchase).toHaveBeenLastCalledWith(
        expect.objectContaining({ receivingInstructions: null }),
      ),
    );
  });

  it("reabrir a compra traz as instruções gravadas", () => {
    const { result } = renderForm();

    act(() =>
      result.current.openEdit({
        id: 3,
        supplierId: 1,
        productName: "CANECA",
        categoryId: 7,
        purchaseDate: "2026-10-20T00:00:00",
        quantity: 1,
        grossTotal: 10,
        finalTotal: 10,
        suggestedPrice: 16.7,
        status: "InTransit",
        images: [],
        items: [],
        receivingInstructions: "Atualizar o código de barras",
      } as unknown as PurchaseDto),
    );

    expect(result.current.form.receivingInstructions).toBe("Atualizar o código de barras");
  });
});

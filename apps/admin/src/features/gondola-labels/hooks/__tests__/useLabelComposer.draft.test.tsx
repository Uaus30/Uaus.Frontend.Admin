import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductLabelDraftDto, ProductPdvSearchDto } from "@workspace/api-client-react";

/**
 * O composer com o rascunho no servidor e a leitura pela câmera (30/09/2026).
 * Os testes do fluxo de montagem e impressão estão em `useLabelComposer.test.tsx`.
 */

const mocks = vi.hoisted(() => ({
  createProductLabelBatch: vi.fn(),
  searchPdvProducts: vi.fn(),
  getProductLabelDraft: vi.fn(),
  saveProductLabelDraft: vi.fn(),
  printLabelSheet: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  createProductLabelBatch: mocks.createProductLabelBatch,
  searchPdvProducts: mocks.searchPdvProducts,
  getProductLabelDraft: mocks.getProductLabelDraft,
  saveProductLabelDraft: mocks.saveProductLabelDraft,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("../../print", () => ({ printLabelSheet: mocks.printLabelSheet }));

const { useLabelComposer } = await import("../useLabelComposer");

function product(id: number, patch?: Partial<ProductPdvSearchDto>): ProductPdvSearchDto {
  return {
    id,
    name: `Produto ${id}`,
    barcode: `789000000000${id}`,
    price: 12.5,
    stock: 5,
    ...patch,
  } as ProductPdvSearchDto;
}

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

async function renderComposer() {
  const rendered = renderHook(() => useLabelComposer(), { wrapper: createWrapper() });
  await waitFor(() => expect(rendered.result.current.canEdit).toBe(true));
  return rendered;
}

/** Rascunho salvo: a caneca com oferta editada e o copo seguindo o cadastro. */
const SAVED_DRAFT: ProductLabelDraftDto = {
  description: "Corredor 3",
  items: [
    {
      productId: 5,
      labelType: "Promotion",
      quantity: 2,
      catalogName: "CANECA",
      catalogPrice: 13.9,
      barcode: "7891234567895",
      customName: "CANECA AZUL",
      customPrice: 9.99,
    },
    { productId: 6, labelType: "Normal", quantity: 1, catalogName: "COPO", catalogPrice: 5.49 },
  ],
};

describe("useLabelComposer — rascunho", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProductLabelDraft.mockResolvedValue(null);
    mocks.saveProductLabelDraft.mockResolvedValue(undefined);
    mocks.searchPdvProducts.mockResolvedValue([]);
    mocks.printLabelSheet.mockResolvedValue(undefined);
    mocks.createProductLabelBatch.mockResolvedValue(null);
  });

  it("não aceita alteração enquanto o rascunho não foi lido", async () => {
    mocks.getProductLabelDraft.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useLabelComposer(), { wrapper: createWrapper() });

    act(() => result.current.addProduct(product(5)));

    expect(result.current.canEdit).toBe(false);
    expect(result.current.items).toHaveLength(0);
    expect(mocks.saveProductLabelDraft).not.toHaveBeenCalled();
  });

  it("remonta a lista salva com o preço de hoje no item que segue o cadastro", async () => {
    mocks.getProductLabelDraft.mockResolvedValue(SAVED_DRAFT);

    const { result } = await renderComposer();

    expect(result.current.description).toBe("Corredor 3");
    expect(result.current.items).toEqual([
      expect.objectContaining({
        productName: "CANECA AZUL",
        priceInput: "9,99",
        labelType: 2,
        quantityInput: "2",
      }),
      expect.objectContaining({ productName: "COPO", priceInput: "5,49", catalogPrice: 5.49, barcode: null }),
    ]);
    // Remontar não é alteração: nada volta para o servidor.
    expect(mocks.saveProductLabelDraft).not.toHaveBeenCalled();
  });

  it("salva sozinho depois de uma alteração, mandando só o que foi editado", async () => {
    const { result } = await renderComposer();

    act(() => result.current.addProduct(product(5, { price: 12.5 })));
    act(() => result.current.addProduct(product(6, { price: 4 })));
    act(() => result.current.updateItem(1, { priceInput: "3,50" }));

    await waitFor(() => expect(mocks.saveProductLabelDraft).toHaveBeenCalled(), { timeout: 2000 });

    // Três alterações seguidas viram UMA gravação, com a lista final.
    expect(mocks.saveProductLabelDraft).toHaveBeenCalledTimes(1);
    expect(mocks.saveProductLabelDraft).toHaveBeenCalledWith({
      description: null,
      items: [
        { productId: 5, labelType: 1, quantity: 1, productName: null, price: null },
        { productId: 6, labelType: 1, quantity: 1, productName: null, price: 3.5 },
      ],
    });
    await waitFor(() => expect(result.current.draftSaveState).toBe("saved"));
  });

  it("limpar apaga o rascunho na hora, sem esperar", async () => {
    mocks.getProductLabelDraft.mockResolvedValue(SAVED_DRAFT);
    const { result } = await renderComposer();

    act(() => result.current.clearBatch());

    // Sem a espera do salvamento automático: limpou e fechou, não pode voltar.
    await waitFor(
      () => expect(mocks.saveProductLabelDraft).toHaveBeenCalledWith({ description: null, items: [] }),
      {
        timeout: 300,
      },
    );
  });

  it("grava o pendente ANTES de gerar o lote, que apaga o rascunho no servidor", async () => {
    const order: string[] = [];
    mocks.saveProductLabelDraft.mockImplementation(async () => void order.push("save"));
    mocks.createProductLabelBatch.mockImplementation(async () => {
      order.push("create");
      return null;
    });
    const { result } = await renderComposer();

    act(() => result.current.addProduct(product(5)));
    await act(async () => result.current.handleGenerate());

    expect(order).toEqual(["save", "create"]);
    expect(mocks.printLabelSheet).toHaveBeenCalled();
    // E nada mais é gravado depois: senão a lista impressa ressuscitaria.
    await new Promise((resolve) => setTimeout(resolve, 900));
    expect(order).toEqual(["save", "create"]);
    expect(result.current.items).toHaveLength(1);
  });

  it("adiciona pelo código lido quando um produto tem exatamente aquele código", async () => {
    mocks.searchPdvProducts.mockResolvedValue([
      product(5, { name: "CANECA", barcode: "7891234567895" }),
      product(7, { name: "CANECA GRANDE", barcode: "17891234567895" }),
    ]);
    const { result } = await renderComposer();

    let first: unknown;
    await act(async () => {
      first = await result.current.addByBarcode("7891234567895");
    });
    let second: unknown;
    await act(async () => {
      second = await result.current.addByBarcode("7891234567895");
    });

    expect(first).toEqual({ kind: "added", name: "CANECA", copies: 1 });
    expect(second).toEqual({ kind: "added", name: "CANECA", copies: 2 });
    // A câmera fecha a cada produto: o nome e as cópias vão para o aviso da tela.
    expect(mocks.toast).toHaveBeenLastCalledWith(
      expect.objectContaining({ description: "CANECA — agora com 2 cópias na lista." }),
    );
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({ productId: 5, quantityInput: "2" });
  });

  it("código sem produto exato não adiciona nada", async () => {
    mocks.searchPdvProducts.mockResolvedValue([product(7, { barcode: "17891234567895" })]);
    const { result } = await renderComposer();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.addByBarcode("7891234567895");
    });

    expect(outcome).toEqual({ kind: "not-found", code: "7891234567895" });
    expect(result.current.items).toHaveLength(0);
  });

  it("código de mais de um produto vai para a busca, e a escolha fica com a pessoa", async () => {
    mocks.searchPdvProducts.mockResolvedValue([
      product(5, { barcode: "7891234567895" }),
      product(8, { barcode: "7891234567895" }),
    ]);
    const { result } = await renderComposer();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.addByBarcode("7891234567895");
    });

    expect(outcome).toEqual({ kind: "ambiguous", code: "7891234567895" });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.search).toBe("7891234567895");
    expect(result.current.hasSearched).toBe(true);
  });

  it("falha na busca do código vira aviso, não exceção", async () => {
    mocks.searchPdvProducts.mockRejectedValue(new Error("502"));
    const { result } = await renderComposer();

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.addByBarcode("7891234567895");
    });

    expect(outcome).toEqual({ kind: "error", code: "7891234567895" });
  });
});

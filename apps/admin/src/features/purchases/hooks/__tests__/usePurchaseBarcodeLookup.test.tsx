import React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ProductDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({ getProductsPage: vi.fn() }));

vi.mock("@/services/products.service", () => ({
  getProductsPage: mocks.getProductsPage,
}));

const { usePurchaseBarcodeLookup } = await import("../usePurchaseBarcodeLookup");

const EAN = "7891234567895";
/** O código interno que a loja grava para quem digita "20". */
const INTERNO_20 = "2000000000206";

function produto(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: 42,
    productGroupId: 5,
    name: "COPO TÉRMICO 500ML",
    description: null,
    barcode: EAN,
    price: 39.9,
    costPrice: 18.4,
    stock: 7,
    minStock: 0,
    status: 2,
    canDelete: true,
    createdAt: "2026-08-01T00:00:00",
    updatedAt: null,
    displayName: "COPO TÉRMICO 500ML",
    variationValues: [],
    imageUrl: null,
    ...overrides,
  };
}

function renderLookup(enabled = true) {
  const onFound = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    ({ ativo }: { ativo: boolean }) => usePurchaseBarcodeLookup({ enabled: ativo, onFound }),
    {
      wrapper,
      initialProps: { ativo: enabled },
    },
  );
  return { ...view, onFound };
}

/** Deixa o tempo do debounce passar e a consulta responder. */
async function esperarDebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(500);
  });
}

describe("usePurchaseBarcodeLookup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.getProductsPage.mockResolvedValue({ data: [produto()], total: 1, totalPages: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("o bipe de um código cadastrado entrega o produto, no formato da busca, para o vínculo", async () => {
    const { result, onFound } = renderLookup();

    act(() => result.current.onBarcodeChange(EAN));
    await esperarDebounce();

    expect(mocks.getProductsPage).toHaveBeenCalledWith({ search: EAN, limit: 20 });
    expect(onFound).toHaveBeenCalledWith(
      {
        id: 42,
        productGroupId: 5,
        name: "COPO TÉRMICO 500ML",
        barcode: EAN,
        stock: 7,
        price: 39.9,
        costPrice: 18.4,
      },
      EAN,
    );
  });

  it("número curto não consulta durante a digitação: '1' é também o começo de '123'", async () => {
    const { result, onFound } = renderLookup();

    act(() => result.current.onBarcodeChange("20"));
    await esperarDebounce();

    expect(mocks.getProductsPage).not.toHaveBeenCalled();
    expect(onFound).not.toHaveBeenCalled();
  });

  it("número curto consulta ao ENCERRAR o campo, pelo código interno que a loja grava", async () => {
    mocks.getProductsPage.mockResolvedValue({
      data: [produto({ barcode: INTERNO_20 })],
      total: 1,
      totalPages: 1,
    });
    const { result, onFound } = renderLookup();

    await act(async () => result.current.onBarcodeCommit("20"));

    expect(mocks.getProductsPage).toHaveBeenCalledWith({ search: INTERNO_20, limit: 20 });
    expect(onFound).toHaveBeenCalledWith(expect.objectContaining({ id: 42 }), INTERNO_20);
  });

  it("código que só CONTÉM o digitado não é duplicata", async () => {
    // O backend filtra por `Contains`: a igualdade é conferida aqui.
    mocks.getProductsPage.mockResolvedValue({
      data: [produto({ barcode: `${EAN}1` })],
      total: 1,
      totalPages: 1,
    });
    const { result, onFound } = renderLookup();

    act(() => result.current.onBarcodeChange(EAN));
    await esperarDebounce();

    expect(onFound).not.toHaveBeenCalled();
  });

  it("o Enter do fim do bipe não repete a consulta que a pausa já fez", async () => {
    mocks.getProductsPage.mockResolvedValue({ data: [], total: 0, totalPages: 0 });
    const { result } = renderLookup();

    act(() => result.current.onBarcodeChange(EAN));
    await esperarDebounce();
    await act(async () => result.current.onBarcodeCommit(EAN));

    expect(mocks.getProductsPage).toHaveBeenCalledTimes(1);
  });

  it("resposta velha não vincula: a pessoa já digitou outra coisa", async () => {
    let responder: (valor: unknown) => void = () => undefined;
    mocks.getProductsPage.mockImplementation(() => new Promise((resolve) => (responder = resolve)));
    const { result, onFound } = renderLookup();

    act(() => result.current.onBarcodeChange(EAN));
    await esperarDebounce();
    // A consulta está em voo e a pessoa apaga um dígito.
    act(() => result.current.onBarcodeChange(EAN.slice(0, 12)));
    await act(async () => responder({ data: [produto()], total: 1, totalPages: 1 }));

    expect(onFound).not.toHaveBeenCalled();
  });

  it("com produto já vinculado (ou modal fechada), nada é consultado", async () => {
    const { result, onFound } = renderLookup(false);

    act(() => result.current.onBarcodeChange(EAN));
    await esperarDebounce();

    expect(mocks.getProductsPage).not.toHaveBeenCalled();
    expect(onFound).not.toHaveBeenCalled();
  });

  it("falha de rede não vira aviso para quem só está digitando", async () => {
    mocks.getProductsPage.mockRejectedValue(new Error("offline"));
    const { result, onFound } = renderLookup();

    act(() => result.current.onBarcodeChange(EAN));
    await esperarDebounce();

    expect(onFound).not.toHaveBeenCalled();
    expect(result.current.searchingBarcode).toBe(false);
  });
});

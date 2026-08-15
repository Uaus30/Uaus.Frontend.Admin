import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchProducts = vi.fn();
const toast = vi.fn();

vi.mock("@/lib/product-search", () => ({
  searchProducts: (...args: unknown[]) => searchProducts(...args),
}));

vi.mock("@workspace/ui", () => ({
  useToast: () => ({ toast }),
}));

const { useProductSearch } = await import("../use-product-search");
const { SEARCH_DEBOUNCE_MS } = await import("../use-debounced-value");

/** Produto de referência, com código de barras de 13 dígitos. */
const COCA = { id: 1, name: "Coca-Cola 350ml", barcode: "7891000100103", price: 5, stock: 10 };
const FANTA = { id: 2, name: "Fanta 350ml", barcode: "7891000100110", price: 4, stock: 3 };

describe("useProductSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    searchProducts.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Digita o termo e deixa o debounce vencer. */
  async function type(setQuery: (value: string) => void, term: string) {
    await act(async () => {
      setQuery(term);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });
  }

  it("deve buscar depois do debounce e guardar os resultados", async () => {
    searchProducts.mockResolvedValue([COCA, FANTA]);

    const { result } = renderHook(() => useProductSearch({ online: true }));

    await act(async () => {
      result.current.setQuery("cola");
    });
    // Antes do debounce vencer nada foi para a rede.
    expect(searchProducts).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });

    expect(searchProducts).toHaveBeenCalledWith("cola", { online: true });
    expect(result.current.results).toHaveLength(2);
  });

  it("não deve buscar com termo menor que o mínimo", async () => {
    const { result } = renderHook(() => useProductSearch({ online: true }));

    await type(result.current.setQuery, "co");

    expect(searchProducts).not.toHaveBeenCalled();
  });

  it("não deve buscar sozinha enquanto estiver desligada", async () => {
    const { result } = renderHook(() => useProductSearch({ online: true, enabled: false }));

    await type(result.current.setQuery, "cola");

    expect(searchProducts).not.toHaveBeenCalled();
  });

  it("deve entregar o produto bipado e limpar a busca no match exato de código de barras", async () => {
    searchProducts.mockResolvedValue([COCA]);
    const onExactBarcodeMatch = vi.fn();

    const { result } = renderHook(() => useProductSearch({ online: true, onExactBarcodeMatch }));

    await type(result.current.setQuery, COCA.barcode);

    expect(onExactBarcodeMatch).toHaveBeenCalledWith(COCA);
    // Campo e lista limpos: o operador bipa o próximo sem tirar a mão do leitor.
    expect(result.current.query).toBe("");
    expect(result.current.results).toEqual([]);
  });

  it("não deve tratar como leitura de código de barras quando o termo casa com dois produtos", async () => {
    searchProducts.mockResolvedValue([COCA, { ...FANTA, barcode: COCA.barcode }]);
    const onExactBarcodeMatch = vi.fn();

    const { result } = renderHook(() => useProductSearch({ online: true, onExactBarcodeMatch }));

    await type(result.current.setQuery, COCA.barcode);

    expect(result.current.results).toHaveLength(2);
    expect(onExactBarcodeMatch).not.toHaveBeenCalled();
  });

  it("deve avisar quem chama quando a busca não encontra nada", async () => {
    searchProducts.mockResolvedValue([]);
    const onEmptyResult = vi.fn();

    const { result } = renderHook(() => useProductSearch({ online: false, onEmptyResult }));

    await type(result.current.setQuery, "xis");

    expect(onEmptyResult).toHaveBeenCalledWith("xis");
    expect(searchProducts).toHaveBeenCalledWith("xis", { online: false });
  });

  it("deve transformar falha da busca em aviso, sem apagar o que já estava na tela", async () => {
    searchProducts.mockResolvedValueOnce([COCA, FANTA]);

    const { result } = renderHook(() => useProductSearch({ online: true }));

    await act(async () => {
      await result.current.search("cola");
    });
    expect(result.current.results).toHaveLength(2);

    searchProducts.mockRejectedValueOnce(new Error("timeout"));
    await act(async () => {
      await result.current.search("guarana");
    });

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Erro na busca", variant: "destructive" }),
    );
    expect(result.current.results).toHaveLength(2);
    expect(result.current.isSearching).toBe(false);
  });

  it("deve esvaziar os resultados quando o termo enviado é vazio", async () => {
    searchProducts.mockResolvedValueOnce([COCA]);

    const { result } = renderHook(() => useProductSearch({ online: true }));

    await act(async () => {
      await result.current.search("cola");
    });
    expect(result.current.results).toHaveLength(1);

    await act(async () => {
      await result.current.search("   ");
    });

    expect(result.current.results).toEqual([]);
    expect(searchProducts).toHaveBeenCalledTimes(1);
  });
});

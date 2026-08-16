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

  it("não deve deixar o indicador ligado depois de um bipe do leitor", async () => {
    // O match exato limpa a busca, e a limpeza invalida a busca corrente — então
    // o `finally` dela não desliga mais nada. Sem desligar na limpeza, o spinner
    // girava até a busca seguinte, depois de CADA produto bipado.
    searchProducts.mockResolvedValue([COCA]);

    const { result } = renderHook(() => useProductSearch({ online: true, onExactBarcodeMatch: vi.fn() }));

    await type(result.current.setQuery, COCA.barcode);

    expect(result.current.isSearching).toBe(false);
  });

  it("deve marcar notFound quando a busca não encontra nada", async () => {
    // O balcão distingue "ainda não procurei" de "procurei e não existe": o
    // primeiro é o painel ocioso, o segundo é o aviso dentro da lista. Sem essa
    // marca os dois seriam `results` vazio.
    searchProducts.mockResolvedValue([]);

    const { result } = renderHook(() => useProductSearch({ online: false }));
    expect(result.current.notFound).toBe(false);

    await type(result.current.setQuery, "xis");

    expect(result.current.notFound).toBe(true);
    expect(searchProducts).toHaveBeenCalledWith("xis", { online: false });
  });

  it("busca com resultado apaga o notFound da busca anterior", async () => {
    searchProducts.mockResolvedValueOnce([]);
    const { result } = renderHook(() => useProductSearch({ online: true }));

    await type(result.current.setQuery, "xis");
    expect(result.current.notFound).toBe(true);

    searchProducts.mockResolvedValueOnce([COCA]);
    await type(result.current.setQuery, "cola");

    expect(result.current.notFound).toBe(false);
  });

  it("limpar a busca tira o aviso de nada encontrado da tela", async () => {
    searchProducts.mockResolvedValue([]);
    const { result } = renderHook(() => useProductSearch({ online: true }));

    await type(result.current.setQuery, "xis");
    expect(result.current.notFound).toBe(true);

    await act(async () => {
      result.current.clear();
    });

    expect(result.current.notFound).toBe(false);
  });

  it("apagar o campo tira o aviso de nada encontrado da tela", async () => {
    searchProducts.mockResolvedValue([]);
    const { result } = renderHook(() => useProductSearch({ online: true }));

    await type(result.current.setQuery, "xis");
    expect(result.current.notFound).toBe(true);

    await act(async () => {
      result.current.setQuery("");
    });

    expect(result.current.notFound).toBe(false);
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

  it("apagar TUDO limpa a lista, mesmo sem nova busca", async () => {
    // Pedido do balcão: a lista sobrevivia ao campo vazio, então a tela ficava
    // afirmando um resultado de uma busca que o operador já abandonou.
    searchProducts.mockResolvedValue([COCA, FANTA]);
    const { result } = renderHook(() => useProductSearch({ online: true }));

    await type(result.current.setQuery, "cola");
    expect(result.current.results).toHaveLength(2);

    await act(async () => {
      result.current.setQuery("");
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.query).toBe("");
  });

  it("apagar UMA LETRA preserva a lista", async () => {
    // A outra metade da regra, e ela é deliberada: quem corrige uma letra não
    // pode ver a lista piscar a cada tecla.
    searchProducts.mockResolvedValue([COCA, FANTA]);
    const { result } = renderHook(() => useProductSearch({ online: true }));

    await type(result.current.setQuery, "cola");

    await act(async () => {
      result.current.setQuery("co");
    });

    expect(result.current.results).toHaveLength(2);
  });

  it("espaço em branco conta como campo vazio", async () => {
    searchProducts.mockResolvedValue([COCA]);
    const { result } = renderHook(() => useProductSearch({ online: true }));

    await type(result.current.setQuery, "cola");

    await act(async () => {
      result.current.setQuery("   ");
    });

    expect(result.current.results).toEqual([]);
  });

  it("resposta que chega DEPOIS de limpar não repõe a lista", async () => {
    // Corrida real do balcão: o operador limpa o campo enquanto a busca está no
    // ar. Sem a guarda de sequência, a resposta antiga traz de volta uma lista
    // que ele acabou de apagar — e ele adiciona o produto errado ao carrinho.
    let resolver: (produtos: unknown[]) => void = () => {};
    searchProducts.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolver = resolve as (p: unknown[]) => void;
        }),
    );

    const { result } = renderHook(() => useProductSearch({ online: true }));

    await act(async () => {
      result.current.setQuery("cola");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    });

    await act(async () => {
      result.current.setQuery("");
    });

    await act(async () => {
      resolver([COCA, FANTA]);
      await Promise.resolve();
    });

    expect(result.current.results).toEqual([]);
  });
});

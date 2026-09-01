import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  searchPdvProducts: vi.fn(),
}));

// Só o que fala com a rede é dublado — o resto do api-client vem do módulo real.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  searchPdvProducts: mocks.searchPdvProducts,
}));

const { useLabelProductSearch, SEARCH_DEBOUNCE_MS } = await import("../useLabelProductSearch");

const CAFE = {
  id: 1,
  name: "CAFE TORRADO 500G",
  barcode: "7891000100103",
  price: 18.9,
  stock: 12,
  groupName: "CAFE",
  imageUrl: "/uploads/cafe.png",
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

function render() {
  return renderHook(() => useLabelProductSearch(), { wrapper: createWrapper() });
}

/**
 * Deixa a resposta da query assentar na tela.
 *
 * São dois avanços porque a busca só COMEÇA no render seguinte ao termo entrar
 * em vigor: o primeiro solta o efeito que dispara a query, o segundo dá o tique
 * em que a promessa resolve e o resultado chega ao estado.
 */
async function assentar() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

/** Deixa o debounce vencer e a resposta da query assentar. */
async function passarODebounce() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
  });
  await assentar();
}

describe("useLabelProductSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.searchPdvProducts.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("abre sem nenhum produto e sem ir à rede", async () => {
    // Regressão: a tela consultava `/Products` com o termo em branco e listava
    // os 8 primeiros produtos do catálogo assim que a aba era aberta.
    const { result } = render();

    await passarODebounce();

    expect(mocks.searchPdvProducts).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
    expect(result.current.hasSearched).toBe(false);
  });

  it("busca sozinha depois do debounce, a partir de 3 caracteres", async () => {
    mocks.searchPdvProducts.mockResolvedValue([CAFE]);
    const { result } = render();

    await act(async () => result.current.setSearch("caf"));
    // Antes de o debounce vencer nada foi para a rede.
    expect(mocks.searchPdvProducts).not.toHaveBeenCalled();

    await passarODebounce();

    expect(mocks.searchPdvProducts).toHaveBeenCalledWith("caf", 20);
    expect(result.current.results).toEqual([CAFE]);
    expect(result.current.hasSearched).toBe(true);
  });

  it("não busca sozinha com menos de 3 caracteres", async () => {
    const { result } = render();

    await act(async () => result.current.setSearch("ca"));
    await passarODebounce();

    expect(mocks.searchPdvProducts).not.toHaveBeenCalled();
    expect(result.current.hasSearched).toBe(false);
  });

  it("o Enter busca na hora, inclusive com termo curto", async () => {
    // É a única saída para "kg", "chá" e outros termos abaixo do mínimo.
    mocks.searchPdvProducts.mockResolvedValue([CAFE]);
    const { result } = render();

    await act(async () => result.current.setSearch("kg"));
    await act(async () => result.current.submit());
    await assentar();

    expect(mocks.searchPdvProducts).toHaveBeenCalledWith("kg", 20);
    expect(result.current.results).toEqual([CAFE]);
  });

  it("esvaziar o campo apaga a lista na hora, sem esperar o debounce", async () => {
    // Deixar o resultado anterior por mais 400ms é tempo de sobra para alguém
    // clicar no "+" do produto errado.
    mocks.searchPdvProducts.mockResolvedValue([CAFE]);
    const { result } = render();

    await act(async () => result.current.setSearch("caf"));
    await passarODebounce();
    expect(result.current.results).toEqual([CAFE]);

    await act(async () => result.current.setSearch(""));

    expect(result.current.results).toEqual([]);
    expect(result.current.hasSearched).toBe(false);
  });

  it("separa a falha da busca de um resultado vazio", async () => {
    // Regressão vista no smoke test: com a API fora do ar a tela dizia "Nenhum
    // produto encontrado", que manda procurar outro termo quando o problema é
    // que ninguém respondeu.
    mocks.searchPdvProducts.mockRejectedValue(new Error("502 Bad Gateway"));
    const { result } = render();

    await act(async () => result.current.setSearch("caf"));
    await passarODebounce();

    expect(result.current.hasFailed).toBe(true);
    expect(result.current.results).toEqual([]);
  });

  it("termo curto não apaga o resultado que já está na tela", async () => {
    // Quem apaga uma letra para corrigir continua vendo a lista anterior em vez
    // de uma lista que pisca.
    mocks.searchPdvProducts.mockResolvedValue([CAFE]);
    const { result } = render();

    await act(async () => result.current.setSearch("caf"));
    await passarODebounce();

    await act(async () => result.current.setSearch("ca"));
    await passarODebounce();

    expect(mocks.searchPdvProducts).toHaveBeenCalledTimes(1);
    expect(result.current.results).toEqual([CAFE]);
  });
});

import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { livro, relatorio, vaso } from "../../__tests__/fixtures";

const mocks = vi.hoisted(() => ({ useGetProductAnomalies: vi.fn(), refetch: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetProductAnomalies: mocks.useGetProductAnomalies,
}));

const { useProductAnomalies } = await import("../useProductAnomalies");

describe("useProductAnomalies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetProductAnomalies.mockReturnValue({
      data: relatorio,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mocks.refetch,
    });
  });

  it("volta a consultar quando a aba volta ao foco — é onde a correção é conferida", () => {
    renderHook(() => useProductAnomalies());

    expect(mocks.useGetProductAnomalies.mock.calls.at(-1)?.[0]).toEqual({
      query: { refetchOnWindowFocus: true },
    });
  });

  it("começa com a lista inteira e as contagens do servidor", () => {
    const { result } = renderHook(() => useProductAnomalies());

    expect(result.current.items.map((x) => x.productGroupId)).toEqual([22, 851, 1]);
    expect(result.current.total).toBe(3);
    expect(result.current.counts.get("PhantomStock")).toBe(1);
    expect(result.current.isFiltered).toBe(false);
  });

  it("a pastilha filtra pelo tipo, e clicar de novo desliga", () => {
    const { result } = renderHook(() => useProductAnomalies());

    act(() => result.current.toggleType("MissingPhoto"));
    expect(result.current.items.map((x) => x.productGroupId)).toEqual([851]);
    expect(result.current.isFiltered).toBe(true);

    act(() => result.current.toggleType("MissingPhoto"));
    expect(result.current.items).toHaveLength(3);
  });

  it("a busca ignora acento e caixa, e acha pelo nome da variação e pelo código do cadastro", () => {
    const { result } = renderHook(() => useProductAnomalies());

    act(() => result.current.setSearch("plastico"));
    expect(result.current.items.map((x) => x.productGroupId)).toEqual([851]);

    act(() => result.current.setSearch("azul"));
    expect(result.current.items.map((x) => x.productGroupId)).toEqual([1]);

    act(() => result.current.setSearch("22"));
    expect(result.current.items.map((x) => x.productGroupId)).toEqual([22]);
  });

  it("filtro e busca não reordenam: a ordem é a da gravidade, do servidor", () => {
    const { result } = renderHook(() => useProductAnomalies());

    act(() => result.current.setSearch("a"));
    expect(result.current.items.map((x) => x.productGroupId)).toEqual([22, 851, 1]);
  });

  it("o interruptor esconde o parado de uma unidade só e reconta as pastilhas; desligado, mostra tudo", () => {
    mocks.useGetProductAnomalies.mockReturnValue({
      data: { ...relatorio, items: [...relatorio.items, livro, vaso] },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mocks.refetch,
    });
    const { result } = renderHook(() => useProductAnomalies());

    // Ligado por padrão: o livro some inteiro; o vaso (7 unidades) fica.
    expect(result.current.ignoreSingleUnits).toBe(true);
    expect(result.current.items.map((x) => x.productGroupId)).toEqual([22, 851, 1, 510]);
    expect(result.current.total).toBe(4);
    expect(result.current.counts.get("NeverSold")).toBeUndefined();
    expect(result.current.counts.get("NoRecentSales")).toBe(1);
    expect(result.current.counts.get("MissingPhoto")).toBe(2);

    act(() => result.current.setIgnoreSingleUnits(false));
    expect(result.current.items.map((x) => x.productGroupId)).toEqual([22, 851, 1, 402, 510]);
    expect(result.current.total).toBe(5);
    expect(result.current.counts.get("NeverSold")).toBe(1);
  });

  it("linha com o parado de uma unidade E outra etiqueta perde só a etiqueta, não a linha", () => {
    const livroSemFoto = { ...livro, anomalies: [{ type: "MissingPhoto" as const }, ...livro.anomalies] };
    mocks.useGetProductAnomalies.mockReturnValue({
      data: { ...relatorio, items: [livroSemFoto] },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: mocks.refetch,
    });
    const { result } = renderHook(() => useProductAnomalies());

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]!.anomalies.map((a) => a.type)).toEqual(["MissingPhoto"]);
    expect(result.current.counts.get("NeverSold")).toBeUndefined();
  });

  it("sem resposta ainda, lista vazia sem quebrar", () => {
    mocks.useGetProductAnomalies.mockReturnValue({
      data: undefined,
      isLoading: true,
      isFetching: true,
      isError: false,
      error: null,
      refetch: mocks.refetch,
    });
    const { result } = renderHook(() => useProductAnomalies());

    expect(result.current.items).toEqual([]);
    expect(result.current.total).toBe(0);
  });
});

import { renderHook, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { relatorio } from "../../__tests__/fixtures";

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

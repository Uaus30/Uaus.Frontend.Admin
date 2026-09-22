import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROFIT_LEADERS_PERIOD } from "@workspace/api-client-react";
import { RELATORIO_DE_TESTE } from "../../__tests__/fixtures";

const mocks = vi.hoisted(() => ({ useGetProfitLeaders: vi.fn() }));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetProfitLeaders: mocks.useGetProfitLeaders,
}));

const { useProfitLeaders } = await import("../useProfitLeaders");

describe("useProfitLeaders", () => {
  beforeEach(() => {
    mocks.useGetProfitLeaders.mockReset();
    mocks.useGetProfitLeaders.mockReturnValue({
      data: RELATORIO_DE_TESTE,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("pede 90 dias por padrao", () => {
    // Em 30 dias a maior parte do catalogo de uma loja de variedades vende poucas
    // vezes, e o ranking vira sorteio.
    renderHook(() => useProfitLeaders());

    expect(mocks.useGetProfitLeaders).toHaveBeenCalledWith(
      expect.objectContaining({ period: PROFIT_LEADERS_PERIOD.Last90Days }),
    );
  });

  it("nao manda as datas quando o periodo e um preset", () => {
    // Preset resolvido no servidor. Mandar datas junto faria a API escolher entre
    // duas fontes de verdade para o mesmo recorte.
    renderHook(() => useProfitLeaders());

    expect(mocks.useGetProfitLeaders).toHaveBeenCalledWith({
      period: PROFIT_LEADERS_PERIOD.Last90Days,
      startDate: undefined,
      endDate: undefined,
    });
  });

  it("filtrar NAO renumera o ranking", () => {
    // A posicao e' do corte inteiro. Renumerar faria a busca inventar um ranking
    // que nao existe — a 2a linha do filtro nao e' a 2a maior do periodo.
    const { result } = renderHook(() => useProfitLeaders());

    act(() => result.current.setSearch("bola"));

    expect(result.current.leaders).toHaveLength(1);
    expect(result.current.leaders[0]!.rank).toBe(2);
  });

  it("busca por nome, codigo de barras e categoria", () => {
    const { result } = renderHook(() => useProfitLeaders());

    act(() => result.current.setSearch("7890000000010"));
    expect(result.current.leaders.length).toBeGreaterThan(0);

    act(() => result.current.setSearch("utilidades"));
    expect(result.current.leaders.length).toBeGreaterThan(0);

    act(() => result.current.setSearch("inexistente"));
    expect(result.current.leaders).toHaveLength(0);
  });

  it("clicar na pastilha ja ativa desliga o filtro", () => {
    const { result } = renderHook(() => useProfitLeaders());

    act(() => result.current.toggleArchetype("Declining"));
    expect(result.current.archetype).toBe("Declining");
    expect(result.current.leaders).toHaveLength(1);

    act(() => result.current.toggleArchetype("Declining"));
    expect(result.current.archetype).toBeNull();
    expect(result.current.leaders).toHaveLength(3);
  });

  it("conta os lideres por arquetipo para as pastilhas", () => {
    const { result } = renderHook(() => useProfitLeaders());

    expect(result.current.counts.get("Declining")).toBe(1);
    expect(result.current.counts.get("Workhorse")).toBe(1);
    expect(result.current.counts.get("Newcomer")).toBeUndefined();
  });

  it("o podio sao as tres primeiras posicoes, na ordem do ranking", () => {
    const { result } = renderHook(() => useProfitLeaders());

    expect(result.current.podium.map((x) => x.rank)).toEqual([1, 2, 3]);
  });

  it("o podio nao encolhe quando a lista esta filtrada", () => {
    // O podio e' do periodo, nao da busca: filtrar por "bola" nao pode fazer a
    // bola virar campea do periodo.
    const { result } = renderHook(() => useProfitLeaders());

    act(() => result.current.setSearch("bola"));

    expect(result.current.podium.map((x) => x.rank)).toEqual([1, 2, 3]);
  });

  it("escolher um preset limpa o intervalo escolhido a mao", () => {
    const { result } = renderHook(() => useProfitLeaders());

    act(() => result.current.handleApplyCustom({ startDate: "2026-07-01", endDate: "2026-07-31" }));
    expect(result.current.period).toBe(PROFIT_LEADERS_PERIOD.Custom);
    expect(result.current.custom).not.toBeNull();

    act(() => result.current.handleSelectPeriod(PROFIT_LEADERS_PERIOD.AllTime));
    expect(result.current.custom).toBeNull();
    expect(mocks.useGetProfitLeaders).toHaveBeenLastCalledWith({
      period: PROFIT_LEADERS_PERIOD.AllTime,
      startDate: undefined,
      endDate: undefined,
    });
  });

  it("o intervalo a mao viaja junto com o preset Custom", () => {
    const { result } = renderHook(() => useProfitLeaders());

    act(() => result.current.handleApplyCustom({ startDate: "2026-07-01", endDate: "2026-07-31" }));

    expect(mocks.useGetProfitLeaders).toHaveBeenLastCalledWith({
      period: PROFIT_LEADERS_PERIOD.Custom,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    });
  });

  it("o resetToken anda a cada limpeza, para o calendario remontar", () => {
    // Sem ele, limpar com `custom` ja nulo aborta o re-render e o gatilho fica
    // anunciando "Selecionar periodo" sobre uma consulta que nao mudou.
    const { result } = renderHook(() => useProfitLeaders());
    const antes = result.current.resetToken;

    act(() => result.current.handleClearCustom());

    expect(result.current.resetToken).toBe(antes + 1);
  });
});

import React from "react";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COMPARISON_DIMENSION } from "@workspace/api-client-react";
import type { DimensionChangeDto, PeriodComparisonReportDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({ useGetPeriodComparison: vi.fn() }));

// Dubla só o hook que fala com a REDE. As chaves de cache continuam vindo do
// api-client — um mock que redefine a chave valida a invenção do próprio mock.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPeriodComparison: mocks.useGetPeriodComparison,
}));

import { usePeriodComparison } from "../usePeriodComparison";

/**
 * Dias entre duas datas `yyyy-MM-dd`, montando `Date` LOCAL a partir dos
 * pedaços. Passar a string direta para `new Date` a leria como UTC.
 */
function diasEntre(inicio: string, fim: string): number {
  const paraData = (valor: string) => {
    const [ano, mes, dia] = valor.split("-").map(Number);
    return new Date(ano, mes - 1, dia).getTime();
  };

  return Math.round((paraData(fim) - paraData(inicio)) / (24 * 60 * 60 * 1000));
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function linha(overrides: Partial<DimensionChangeDto>): DimensionChangeDto {
  return {
    id: 1,
    name: "Utilidades",
    previousRevenue: 100,
    currentRevenue: 80,
    revenueDelta: -20,
    revenueDeltaPercentage: -20,
    previousProfit: 40,
    currentProfit: 30,
    profitDelta: -10,
    previousUnits: 10,
    currentUnits: 8,
    previousAveragePrice: 10,
    currentAveragePrice: 10,
    previousShare: 50,
    currentShare: 40,
    shareOfMovement: 100,
    status: "Shrank",
    isBucket: false,
    ...overrides,
  };
}

const RELATORIO: PeriodComparisonReportDto = {
  previous: {
    startDate: "2026-06-01T00:00:00",
    endDate: "2026-06-30T00:00:00",
    days: 30,
    openDays: 25,
    revenue: 10243.99,
    itemRevenue: 10243.99,
    unattributedRevenue: 0,
    profit: 4072,
    marginPercentage: 39.8,
    sales: 339,
    units: 1038,
    averageTicket: 30.22,
    salesPerDay: 13.56,
    unitsPerSale: 3.06,
    revenuePerUnit: 9.87,
  },
  current: {
    startDate: "2026-08-01T00:00:00",
    endDate: "2026-08-31T00:00:00",
    days: 31,
    openDays: 26,
    revenue: 7421.3,
    itemRevenue: 7421.3,
    unattributedRevenue: 0,
    profit: 3058,
    marginPercentage: 41.2,
    sales: 332,
    units: 1238,
    averageTicket: 22.35,
    salesPerDay: 12.77,
    unitsPerSale: 3.73,
    revenuePerUnit: 5.99,
  },
  dimension: "Category",
  bridge: [
    {
      factor: "OpenDays",
      previousValue: 25,
      currentValue: 26,
      changePercentage: 4,
      amount: 352.23,
      shareOfMovement: 4.97,
    },
    {
      factor: "SalesPerDay",
      previousValue: 13.56,
      currentValue: 12.77,
      changePercentage: -5.83,
      amount: -538.21,
      shareOfMovement: 7.6,
    },
    {
      factor: "UnitsPerSale",
      previousValue: 3.06,
      currentValue: 3.73,
      changePercentage: 21.78,
      amount: 1777.08,
      shareOfMovement: 25.1,
    },
    {
      factor: "RevenuePerUnit",
      previousValue: 9.87,
      currentValue: 5.99,
      changePercentage: -39.26,
      amount: -4413.79,
      shareOfMovement: 62.33,
    },
  ],
  changes: [
    linha({ id: 1, name: "Vestuário", revenueDelta: -1883.6 }),
    linha({ id: 2, name: "Potes", revenueDelta: -693 }),
    linha({ id: 3, name: "Unhas", revenueDelta: 233, status: "Grew" }),
  ],
  mixPrice: {
    measuredBy: "Category",
    previousRevenuePerUnit: 9.87,
    currentRevenuePerUnit: 5.99,
    change: -3.88,
    mixEffect: -2.06,
    priceEffect: -1.82,
    mixAmount: -2550.28,
    priceAmount: -2253.16,
    contributions: [],
  },
  eventItems: [],
};

describe("usePeriodComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetPeriodComparison.mockReturnValue({
      data: RELATORIO,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("compara 30 dias com os 30 anteriores por padrão, sem sobrepor", () => {
    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    const { previousStartDate, previousEndDate, currentStartDate, currentEndDate } = result.current.range;

    // As duas janelas têm 30 dias E são adjacentes. A conta passa por
    // `diasEntre`, que fatia a string — `toISOString()` converteria para UTC e a
    // asserção deixaria de valer fora da faixa de fuso do Brasil (armadilha 2).
    expect(diasEntre(previousStartDate, previousEndDate)).toBe(29);
    expect(diasEntre(currentStartDate, currentEndDate)).toBe(29);
    expect(diasEntre(previousEndDate, currentStartDate)).toBe(1);
  });

  it("o preset de mês corta os DOIS lados no mesmo número de dias", () => {
    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    act(() => result.current.handleSelectPreset("mes"));

    const { previousStartDate, previousEndDate, currentStartDate, currentEndDate } = result.current.range;

    // Em 31/03 a versão anterior comparava 31 dias de março com 28 de fevereiro
    // e anunciava os 3 dias a mais como crescimento.
    expect(diasEntre(previousStartDate, previousEndDate)).toBe(diasEntre(currentStartDate, currentEndDate));
    expect(previousEndDate < currentStartDate).toBe(true);
  });

  it("escolher o 'depois' antes do 'antes' não gera períodos sobrepostos", () => {
    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    // O caso real: o usuário mexe primeiro no calendário "Depois" e escolhe um
    // intervalo que cruza o de referência. Sem normalização a API respondia 400
    // e todos os blocos da tela sumiam.
    act(() =>
      result.current.handleApplyCustom(
        {
          previousStartDate: "2026-07-23",
          previousEndDate: "2026-08-21",
          currentStartDate: "2026-07-01",
          currentEndDate: "2026-07-31",
          label: "Períodos escolhidos no calendário",
        },
        "current",
      ),
    );

    const { previousStartDate, previousEndDate, currentStartDate } = result.current.range;

    expect(previousEndDate < currentStartDate).toBe(true);
    // O que o usuário acabou de escolher fica INTACTO, inclusive como o lado em
    // análise: só ordenar os dois pela data transformaria a escolha dele em
    // período de referência — resposta correta para outra pergunta.
    expect(currentStartDate).toBe("2026-07-01");
    expect(result.current.range.currentEndDate).toBe("2026-07-31");
    expect(previousEndDate).toBe("2026-06-30");
    expect(diasEntre(previousStartDate, previousEndDate)).toBe(29);
  });

  it("o período em análise nunca passa de hoje", () => {
    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    // Mexer no "Antes" empurra o "Depois" para a frente — e empurrar sem teto
    // criava um período em análise no FUTURO, com a tela anunciando −100% e
    // nomeando a causa de algo que ainda não aconteceu.
    act(() =>
      result.current.handleApplyCustom(
        {
          previousStartDate: "2026-08-01",
          previousEndDate: "2026-08-31",
          currentStartDate: "2026-08-23",
          currentEndDate: "2026-09-21",
          label: "Períodos escolhidos no calendário",
        },
        "previous",
      ),
    );

    const hoje = new Date();
    const hojeIso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(
      hoje.getDate(),
    ).padStart(2, "0")}`;

    expect(result.current.range.currentEndDate <= hojeIso).toBe(true);
    expect(result.current.range.previousEndDate < result.current.range.currentStartDate).toBe(true);
  });

  it("mexer no 'antes' empurra o 'depois', e não o contrário", () => {
    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    // Data com folga de futuro, para exercitar o empurrão sem esbarrar no teto
    // de hoje — que é o assunto do teste anterior.
    act(() =>
      result.current.handleApplyCustom(
        {
          previousStartDate: "2026-01-01",
          previousEndDate: "2026-01-31",
          currentStartDate: "2026-01-15",
          currentEndDate: "2026-02-13",
          label: "Períodos escolhidos no calendário",
        },
        "previous",
      ),
    );

    const { previousStartDate, previousEndDate, currentStartDate, currentEndDate } = result.current.range;

    expect(previousStartDate).toBe("2026-01-01");
    expect(previousEndDate).toBe("2026-01-31");
    expect(currentStartDate).toBe("2026-02-01");
    // A duração do lado que se moveu é preservada: 30 dias continuam 30 dias.
    expect(diasEntre(currentStartDate, currentEndDate)).toBe(29);
  });

  it("sem espaço no futuro, o que o usuário escolheu vira o período em análise", () => {
    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    const hoje = new Date();
    const iso = (data: Date) =>
      `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(
        data.getDate(),
      ).padStart(2, "0")}`;

    const dezDiasAtras = new Date(hoje);
    dezDiasAtras.setDate(hoje.getDate() - 10);

    // Ele escolheu como REFERÊNCIA um intervalo que termina hoje: não sobra
    // futuro nenhum para o período em análise. Empurrar assim mesmo criava datas
    // que ainda não aconteceram.
    act(() =>
      result.current.handleApplyCustom(
        {
          previousStartDate: iso(dezDiasAtras),
          previousEndDate: iso(hoje),
          currentStartDate: iso(dezDiasAtras),
          currentEndDate: iso(hoje),
          label: "Períodos escolhidos no calendário",
        },
        "previous",
      ),
    );

    const { previousEndDate, currentStartDate, currentEndDate } = result.current.range;

    // O intervalo escolhido é o mais recente dos dois, então é ele o que está em
    // análise; a referência recua para os dias imediatamente anteriores.
    expect(currentStartDate).toBe(iso(dezDiasAtras));
    expect(currentEndDate).toBe(iso(hoje));
    expect(previousEndDate < currentStartDate).toBe(true);
  });

  it("manda os dois períodos e a dimensão ao servidor", () => {
    renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    expect(mocks.useGetPeriodComparison).toHaveBeenCalledWith(
      expect.objectContaining({ dimension: COMPARISON_DIMENSION.Category }),
    );
  });

  it("aponta o fator de maior módulo, e não o maior negativo", () => {
    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    expect(result.current.leadingFactor?.factor).toBe("RevenuePerUnit");
  });

  it("aponta a alta quando ela é o que mais pesou", () => {
    mocks.useGetPeriodComparison.mockReturnValue({
      data: {
        ...RELATORIO,
        bridge: [
          { ...RELATORIO.bridge[0], amount: 90 },
          { ...RELATORIO.bridge[1], amount: -20 },
          { ...RELATORIO.bridge[2], amount: 5 },
          { ...RELATORIO.bridge[3], amount: -10 },
        ],
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    expect(result.current.leadingFactor?.factor).toBe("OpenDays");
  });

  it("ordena com a maior perda no topo", () => {
    // O mock chega FORA de ordem de propósito: com ele já ordenado, o teste
    // passaria mesmo se o hook não ordenasse nada.
    mocks.useGetPeriodComparison.mockReturnValue({
      data: {
        ...RELATORIO,
        changes: [
          linha({ id: 3, name: "Unhas", revenueDelta: 233, status: "Grew" }),
          linha({ id: 2, name: "Potes", revenueDelta: -693 }),
          linha({ id: 1, name: "Vestuário", revenueDelta: -1883.6 }),
        ],
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    expect(result.current.changes.map((x) => x.name)).toEqual(["Vestuário", "Potes", "Unhas"]);
  });

  it("acha o fator líder mesmo com a parcela sem item na ponte", () => {
    // A fixture padrão tem 4 barras; o backend sempre manda 5.
    mocks.useGetPeriodComparison.mockReturnValue({
      data: {
        ...RELATORIO,
        bridge: [
          ...RELATORIO.bridge,
          {
            factor: "Unattributed" as const,
            previousValue: 0,
            currentValue: 97.6,
            changePercentage: 0,
            amount: 97.6,
            shareOfMovement: 1.3,
          },
        ],
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    expect(result.current.leadingFactor?.factor).toBe("RevenuePerUnit");
  });

  it("clicar na mesma coluna inverte a ordem", () => {
    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    act(() => result.current.ordenarPor("delta"));

    expect(result.current.sort).toEqual({ coluna: "delta", ordem: "desc" });
    expect(result.current.changes[0].name).toBe("Unhas");
  });

  it("coluna nova começa decrescente", () => {
    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    act(() => result.current.ordenarPor("currentRevenue"));

    expect(result.current.sort).toEqual({ coluna: "currentRevenue", ordem: "desc" });
  });

  it("a busca filtra pelo nome da linha", () => {
    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    act(() => result.current.setSearch("pot"));

    expect(result.current.changes.map((x) => x.name)).toEqual(["Potes"]);
  });

  it("o preset de mês fechado não cruza os dois meses", () => {
    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    act(() => result.current.handleSelectPreset("mesFechado"));

    const { previousEndDate, currentStartDate, currentEndDate } = result.current.range;

    expect(previousEndDate < currentStartDate).toBe(true);
    // O mês em análise é fechado: começa no dia 1 e termina no último dia.
    expect(currentStartDate.endsWith("-01")).toBe(true);
    expect(new Date(`${currentEndDate}T12:00:00`).getMonth()).toBe(
      new Date(`${currentStartDate}T12:00:00`).getMonth(),
    );
  });

  it("o intervalo escolhido no calendário substitui o preset", () => {
    const { result } = renderHook(() => usePeriodComparison(), { wrapper: createWrapper() });

    act(() =>
      result.current.handleApplyCustom({
        previousStartDate: "2026-06-01",
        previousEndDate: "2026-06-30",
        currentStartDate: "2026-08-01",
        currentEndDate: "2026-08-31",
        label: "Períodos escolhidos no calendário",
      }),
    );

    expect(result.current.range.currentStartDate).toBe("2026-08-01");
    expect(result.current.custom).not.toBeNull();

    act(() => result.current.handleClearCustom());

    expect(result.current.custom).toBeNull();
  });
});

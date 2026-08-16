import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { endOfDay, startOfDay, subDays } from "date-fns";
import { useLogs, getDefaultDateRange } from "../useLogs";

// Mock do toast
const mockToast = vi.fn();
vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mockToast }),
}));

// Mock do serviço de enums
vi.mock("@/services/core", () => ({
  getEnumOptions: vi.fn(() =>
    Promise.resolve([
      { id: 1, name: "Info", value: "info", allowSelect: true },
      { id: 2, name: "Error", value: "error", allowSelect: true },
    ]),
  ),
}));

// Mock do API Client para logs
const mockGetLogs = vi.fn((_params?: unknown) => ({
  data: {
    data: [
      {
        id: 1,
        type: "INFO",
        message: "Log test message",
        origin: "System",
        code: "SYS-001",
        createdAt: "2026-06-18T22:51:38-03:00",
      },
    ],
    total: 1,
    page: 1,
    limit: 25,
    totalPages: 1,
  },
  isLoading: false,
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetLogs: (params: unknown) => mockGetLogs(params),
}));

// Wrapper de testes para prover o QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useLogs Hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deve inicializar com os estados padrão corretos", () => {
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.limit).toBe(25);
    expect(result.current.draftSearch).toBe("");
    expect(result.current.draftType).toBe("all");
    expect(result.current.draftDateRange).toBeDefined();
  });

  it("deve aplicar os filtros de busca ao chamar handleSearch", () => {
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() });

    act(() => {
      result.current.setDraftSearch("critical error");
      result.current.setDraftType("error");
    });

    expect(result.current.draftSearch).toBe("critical error");
    expect(result.current.draftType).toBe("error");

    act(() => {
      result.current.handleSearch();
    });

    expect(result.current.appliedSearch).toBe("critical error");
    expect(result.current.appliedType).toBe("error");
    expect(result.current.page).toBe(1);
  });

  it("deve enviar as datas do filtro no fuso LOCAL, sem o deslocamento do toISOString", () => {
    // Regressão: toISOString() produzia instantes UTC ("...Z") contra
    // timestamps gravados em horário de Brasília sem fuso — a janela do filtro
    // ficava deslocada 3 horas (docs/fuso-horario.md do backend).
    const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() });

    act(() => {
      result.current.setDraftDateRange({
        from: new Date(2026, 7, 1), // 01/08/2026 (mês é zero-based)
        to: new Date(2026, 7, 7), // 07/08/2026
      });
    });
    act(() => {
      result.current.handleSearch();
    });

    const calls = mockGetLogs.mock.calls as unknown as Array<[Record<string, unknown>]>;
    const lastParams = calls[calls.length - 1][0];

    expect(lastParams.startDate).toBe("2026-08-01T00:00:00");
    expect(lastParams.endDate).toBe("2026-08-07T23:59:59");
    expect(String(lastParams.startDate)).not.toContain("Z");
    expect(String(lastParams.endDate)).not.toContain("Z");
  });
});

describe("getDefaultDateRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deve calcular o período no momento da chamada, não no import do módulo", () => {
    // Regressão: a constante de módulo congelava o "hoje" no primeiro import;
    // após a virada do dia o filtro padrão parava de incluir o dia corrente.
    vi.setSystemTime(new Date(2026, 7, 7, 23, 50, 0));
    const beforeMidnight = getDefaultDateRange();
    expect(beforeMidnight.from).toEqual(startOfDay(subDays(new Date(2026, 7, 7), 7)));
    expect(beforeMidnight.to).toEqual(endOfDay(new Date(2026, 7, 7)));

    vi.setSystemTime(new Date(2026, 7, 8, 0, 10, 0));
    const afterMidnight = getDefaultDateRange();
    expect(afterMidnight.to).toEqual(endOfDay(new Date(2026, 7, 8)));
    expect(afterMidnight.to!.getTime()).toBeGreaterThan(beforeMidnight.to!.getTime());
  });
});

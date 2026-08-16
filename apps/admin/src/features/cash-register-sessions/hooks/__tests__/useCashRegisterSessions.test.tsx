import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useGetCashRegisterSessions: vi.fn(),
  useGetCashRegisterSessionById: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCashRegisterSessions: mocks.useGetCashRegisterSessions,
  useGetCashRegisterSessionById: mocks.useGetCashRegisterSessionById,
  CASH_REGISTER_SESSION_OPEN: 1,
  CASH_REGISTER_SESSION_CLOSED: 2,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useCashRegisterSessions, statusFilterToCode } = await import("../useCashRegisterSessions");

/** Sessão fechada mínima para a listagem dos testes. */
const closedSession = {
  id: 7,
  createdAt: "2026-08-01T08:00:00",
  updatedAt: null,
  userId: 3,
  userName: "Maria",
  openedAt: "2026-08-01T08:00:00",
  openingBalance: 100,
  openingNotes: null,
  closedAt: "2026-08-01T18:00:00",
  closedByUserId: 3,
  closedByUserName: "Maria",
  countedAmount: 350,
  expectedAmount: 350,
  difference: 0,
  closingNotes: null,
  status: 2,
  summary: null,
};

/** Retorno padrão da listagem: uma página com a sessão fechada. */
const defaultListResult = {
  data: {
    data: [closedSession],
    page: 1,
    limit: 10,
    total: 1,
    totalPages: 1,
  },
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Parâmetros da última chamada ao hook de listagem. */
function lastListParams() {
  const calls = mocks.useGetCashRegisterSessions.mock.calls;
  return calls[calls.length - 1][0];
}

/** ID passado na última chamada ao hook de detalhe. */
function lastDetailsId() {
  const calls = mocks.useGetCashRegisterSessionById.mock.calls;
  return calls[calls.length - 1][0];
}

describe("useCashRegisterSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetCashRegisterSessions.mockReturnValue(defaultListResult);
    mocks.useGetCashRegisterSessionById.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("deve inicializar com os estados padrão corretos", () => {
    const { result } = renderHook(() => useCashRegisterSessions(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.statusFilter).toBe("all");
    expect(result.current.startDate).toBe("");
    expect(result.current.endDate).toBe("");
    expect(result.current.detailsOpen).toBe(false);
    expect(result.current.selectedSessionId).toBeNull();
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.pagination).toEqual({
      page: 1,
      size: 10,
      filteredItems: 1,
      totalPages: 1,
    });

    // Sem filtros, a listagem sai sem status nem período, na primeira página de 10.
    expect(lastListParams()).toEqual({
      status: undefined,
      startDate: undefined,
      endDate: undefined,
      page: 1,
      size: 10,
    });
  });

  it("deve converter o filtro de status para o código numérico da API", () => {
    expect(statusFilterToCode("all")).toBeUndefined();
    expect(statusFilterToCode("open")).toBe(1);
    expect(statusFilterToCode("closed")).toBe(2);
  });

  it("deve filtrar por abertos e voltar para a primeira página", () => {
    const { result } = renderHook(() => useCashRegisterSessions(), { wrapper: createWrapper() });

    act(() => result.current.setPage(3));
    act(() => result.current.setStatusFilter("open"));

    expect(result.current.statusFilter).toBe("open");
    expect(result.current.page).toBe(1);
    expect(lastListParams()).toMatchObject({ status: 1, page: 1 });
  });

  it("deve aplicar o período e voltar para a primeira página", () => {
    const { result } = renderHook(() => useCashRegisterSessions(), { wrapper: createWrapper() });

    act(() => result.current.setPage(2));
    act(() => result.current.setPeriod("2026-08-01", "2026-08-07"));

    expect(result.current.startDate).toBe("2026-08-01");
    expect(result.current.endDate).toBe("2026-08-07");
    expect(result.current.page).toBe(1);
    expect(lastListParams()).toMatchObject({
      startDate: "2026-08-01",
      endDate: "2026-08-07",
      page: 1,
    });
  });

  it("deve limpar o período enviando as datas como indefinidas", () => {
    const { result } = renderHook(() => useCashRegisterSessions(), { wrapper: createWrapper() });

    act(() => result.current.setPeriod("2026-08-01", "2026-08-07"));
    act(() => result.current.setPeriod("", ""));

    expect(lastListParams()).toMatchObject({ startDate: undefined, endDate: undefined });
  });

  it("deve abrir o detalhe da sessão clicada e consultar pelo id", () => {
    const { result } = renderHook(() => useCashRegisterSessions(), { wrapper: createWrapper() });

    // Fechado, o Dialog não dispara a consulta de detalhe.
    expect(lastDetailsId()).toBeUndefined();

    act(() => result.current.openDetails(7));

    expect(result.current.detailsOpen).toBe(true);
    expect(result.current.selectedSessionId).toBe(7);
    expect(lastDetailsId()).toBe(7);
  });

  it("deve fechar o detalhe sem perder a sessão selecionada", () => {
    const { result } = renderHook(() => useCashRegisterSessions(), { wrapper: createWrapper() });

    act(() => result.current.openDetails(7));
    act(() => result.current.closeDetails());

    expect(result.current.detailsOpen).toBe(false);
    // O id fica — e continua indo para a consulta — para o conteúdo do Dialog
    // não piscar para a mensagem de erro durante o fade-out.
    expect(result.current.selectedSessionId).toBe(7);
    expect(lastDetailsId()).toBe(7);
  });

  it("deve avisar com a mensagem do backend quando a listagem falha", async () => {
    mocks.useGetCashRegisterSessions.mockReturnValue({
      ...defaultListResult,
      data: undefined,
      isError: true,
      error: Object.assign(new Error("Acesso restrito ao administrador."), {
        status: 403,
        payload: { message: "Acesso restrito ao administrador." },
      }),
    });

    const { result } = renderHook(() => useCashRegisterSessions(), { wrapper: createWrapper() });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao carregar as sessões de caixa",
          description: "Acesso restrito ao administrador.",
          variant: "destructive",
        }),
      ),
    );
    expect(result.current.sessions).toHaveLength(0);
    expect(result.current.pagination).toBeUndefined();
  });
});

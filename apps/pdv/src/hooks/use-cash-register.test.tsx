import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const openCashRegisterSession = vi.fn();
const closeCashRegisterSession = vi.fn();
const useGetCurrentCashRegisterSession = vi.fn();
const getSessionSales = vi.fn();

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  CURRENT_CASH_REGISTER_SESSION_QUERY_KEY: ["cash-register-session-current"],
  openCashRegisterSession: (...args: unknown[]) => openCashRegisterSession(...args),
  closeCashRegisterSession: (...args: unknown[]) => closeCashRegisterSession(...args),
  useGetCurrentCashRegisterSession: (...args: unknown[]) => useGetCurrentCashRegisterSession(...args),
}));

vi.mock("@/services/sales.service", () => ({
  getSessionSales: (...args: unknown[]) => getSessionSales(...args),
}));

const { useCashRegister } = await import("./use-cash-register");

/** Sessão aberta de referência, com fundo de troco de R$ 100,00. */
const OPEN_SESSION = {
  id: 7,
  status: 1,
  openingBalance: 100,
  summary: { salesCount: 2, revenue: 80, cashAmount: 50, expectedCashAmount: 150 },
};

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

/** Simula o retorno do hook que busca a sessão aberta. */
function mockSession(session: unknown, isLoading = false) {
  useGetCurrentCashRegisterSession.mockReturnValue({
    data: session,
    isLoading,
    refetch: vi.fn(),
  });
}

describe("useCashRegister", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionSales.mockResolvedValue([{ id: 1, total: 50 }]);
  });

  it("deve expor a sessão aberta e o resumo consolidado", async () => {
    mockSession(OPEN_SESSION);

    const { result } = renderHook(() => useCashRegister(), { wrapper: createWrapper() });

    expect(result.current.sessionId).toBe(7);
    expect(result.current.summary?.expectedCashAmount).toBe(150);
    await waitFor(() => expect(result.current.sales).toHaveLength(1));
    expect(getSessionSales).toHaveBeenCalledWith(7);
  });

  it("não deve buscar vendas com o caixa fechado", async () => {
    mockSession(null);

    const { result } = renderHook(() => useCashRegister(), { wrapper: createWrapper() });

    expect(result.current.session).toBeNull();
    expect(result.current.sessionId).toBeNull();
    expect(result.current.summary).toBeNull();
    expect(result.current.sales).toEqual([]);
    expect(getSessionSales).not.toHaveBeenCalled();
  });

  it("ligar o controle de caixa põe a sessão em carregamento DEPOIS da primeira carga", async () => {
    // Este é o gatilho de um bug de foco que ninguém conseguia reproduzir:
    // `/CompanySettings` responde depois de `/me`, e enquanto ela não responde o
    // padrão é "loja SEM controle de caixa" — a consulta de sessão nasce
    // desligada. Quando a resposta chega dizendo que a loja usa caixa, `enabled`
    // vira verdadeiro e `loadingSession` sai de FALSO para VERDADEIRO com o
    // operador já usando a tela. Quem consome não pode tratar isso como
    // primeira carga: `pages/pdv.tsx` desmontava o PDV inteiro e o cursor do
    // campo de busca ficava para trás.
    mockSession(undefined, true);

    const { result, rerender } = renderHook(({ enabled }) => useCashRegister({ enabled }), {
      wrapper: createWrapper(),
      initialProps: { enabled: false },
    });

    // Consulta desligada: não há sessão a carregar.
    expect(result.current.loadingSession).toBe(false);

    rerender({ enabled: true });

    expect(result.current.loadingSession).toBe(true);
  });

  it("deve abrir o caixa com o fundo de troco informado", async () => {
    mockSession(null);
    openCashRegisterSession.mockResolvedValue({ id: 8 });

    const { result } = renderHook(() => useCashRegister(), { wrapper: createWrapper() });

    await act(() => result.current.open(200, "  turno da manhã  "));

    expect(openCashRegisterSession).toHaveBeenCalledWith({
      openingBalance: 200,
      openingNotes: "turno da manhã",
    });
  });

  it("deve enviar observação nula quando ela vem em branco", async () => {
    mockSession(null);
    openCashRegisterSession.mockResolvedValue({ id: 8 });

    const { result } = renderHook(() => useCashRegister(), { wrapper: createWrapper() });

    await act(() => result.current.open(0, "   "));

    expect(openCashRegisterSession).toHaveBeenCalledWith({ openingBalance: 0, openingNotes: null });
  });

  it("deve fechar o caixa devolvendo a diferença apurada", async () => {
    mockSession(OPEN_SESSION);
    closeCashRegisterSession.mockResolvedValue({ id: 7, difference: -10 });

    const { result } = renderHook(() => useCashRegister(), { wrapper: createWrapper() });

    let closed: { difference: number } | undefined;
    await act(async () => {
      closed = (await result.current.close(140, "faltou troco")) as { difference: number };
    });

    expect(closeCashRegisterSession).toHaveBeenCalledWith(7, {
      countedAmount: 140,
      closingNotes: "faltou troco",
    });
    expect(closed?.difference).toBe(-10);
  });

  it("deve recusar o fechamento sem caixa aberto", async () => {
    mockSession(null);

    const { result } = renderHook(() => useCashRegister(), { wrapper: createWrapper() });

    await expect(result.current.close(100)).rejects.toThrow("Nenhum caixa aberto para fechar.");
  });
});

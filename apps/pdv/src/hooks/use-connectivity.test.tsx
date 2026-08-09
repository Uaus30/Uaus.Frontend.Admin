import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const watchConnectivity = vi.fn();
const setOnline = vi.fn();
const syncNow = vi.fn();
const refreshCounts = vi.fn();

vi.mock("@/offline", () => ({
  watchConnectivity: (...args: unknown[]) => watchConnectivity(...args),
}));

vi.mock("@/stores/use-offline-store", () => ({
  useOfflineStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ setOnline, syncNow, refreshCounts }),
}));

const { useConnectivity } = await import("./use-connectivity");

/** Resumo de uma rodada que enviou uma venda ao servidor. */
function outcomeWithSale() {
  return {
    sales: { created: 1, duplicated: 0, rejected: 0, remaining: 0 },
    writeOffs: { sent: 0, rejected: 0, remaining: 0 },
    remaining: 0,
  };
}

function createWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

/** Renderiza o hook e devolve o listener registrado no monitor de conexão. */
function renderConnectivity(client = new QueryClient()) {
  let listener: ((online: boolean) => void) | null = null;
  watchConnectivity.mockImplementation((callback: (online: boolean) => void) => {
    listener = callback;
    return () => undefined;
  });

  renderHook(() => useConnectivity(), { wrapper: createWrapper(client) });

  if (!listener) throw new Error("O monitor de conexão não foi registrado.");
  return listener as (online: boolean) => void;
}

beforeEach(() => {
  vi.clearAllMocks();
  refreshCounts.mockResolvedValue(undefined);
  syncNow.mockResolvedValue(null);
});

describe("useConnectivity", () => {
  it("deve sincronizar já na primeira sondagem online", async () => {
    // Regressão: a primeira sondagem era deliberadamente ignorada, então um PDV
    // que abria JÁ online com fila de uma queda anterior (queda de energia, F5)
    // nunca sincronizava sozinho — as vendas ficavam fora do servidor o turno
    // inteiro, até alguém clicar em "Sincronizar" ou tentar fechar o caixa.
    const listener = renderConnectivity();

    act(() => listener(true));

    expect(setOnline).toHaveBeenCalledWith(true);
    await waitFor(() => expect(syncNow).toHaveBeenCalledTimes(1));
  });

  it("não deve sincronizar quando a sondagem dá offline", () => {
    const listener = renderConnectivity();

    act(() => listener(false));

    expect(setOnline).toHaveBeenCalledWith(false);
    expect(syncNow).not.toHaveBeenCalled();
  });

  it("deve sincronizar de novo na reconexão", async () => {
    const listener = renderConnectivity();

    act(() => listener(true));
    act(() => listener(false));
    act(() => listener(true));

    await waitFor(() => expect(syncNow).toHaveBeenCalledTimes(2));
  });

  it("deve invalidar o cache só quando algo mudou no servidor", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const listener = renderConnectivity(client);

    // Rodada sem nada a fazer: nenhum recarregamento.
    act(() => listener(true));
    await waitFor(() => expect(syncNow).toHaveBeenCalledTimes(1));
    expect(invalidate).not.toHaveBeenCalled();

    // Rodada que gravou venda: o histórico precisa refletir o que subiu.
    syncNow.mockResolvedValue(outcomeWithSale());
    act(() => listener(false));
    act(() => listener(true));
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(1));
  });
});

import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ toast: vi.fn() }));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { usePdvSessionActions } = await import("../use-pdv-session-actions");
const { useOfflineStore } = await import("@/stores/use-offline-store");

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** A rodada que o pedido de fechamento dispara, com duas vendas que não subiram. */
function rodada(blockedByStockFreeze: boolean) {
  return {
    sales: { created: 0, duplicated: 0, rejected: 0, remaining: 2 },
    writeOffs: { sent: 0, rejected: 0, remaining: 0 },
    remaining: 2,
    blockedByStockFreeze,
  };
}

function renderActions(blockedByStockFreeze: boolean) {
  const syncPendingQueues = vi.fn().mockResolvedValue(rodada(blockedByStockFreeze));
  return renderHook(
    () =>
      usePdvSessionActions({
        sessionId: 3,
        online: true,
        queuedCount: 2,
        openCashRegister: vi.fn(),
        syncPendingQueues,
      }),
    { wrapper },
  );
}

describe("usePdvSessionActions — fechar o caixa com a fila parada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useOfflineStore.setState({ pending: 2, failed: 0, pendingWriteOffs: 0, failedWriteOffs: 0 });
  });

  it("com a conferência de estoque aberta, diz que a fila espera o encerramento", async () => {
    // "Resolva a fila" mandaria o operador procurar um problema que não tem:
    // a fila sobe sozinha quando a conferência for encerrada.
    const { result } = renderActions(true);

    await act(() => result.current.requestCloseRegister());

    const aviso = mocks.toast.mock.calls.at(-1)?.[0];
    expect(aviso.description).toMatch(/esperam a conferência de estoque ser encerrada/);
    expect(aviso.description).not.toMatch(/resolva a fila/);
    expect(result.current.isCloseRegisterOpen).toBe(false);
  });

  it("sem conferência, segue mandando resolver a fila", async () => {
    const { result } = renderActions(false);

    await act(() => result.current.requestCloseRegister());

    expect(mocks.toast.mock.calls.at(-1)?.[0].description).toMatch(/resolva a fila/);
    expect(result.current.isCloseRegisterOpen).toBe(false);
  });
});

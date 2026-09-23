import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Com o store de fila REAL: o `syncNow` devolve a MESMA promessa a quem chega
// durante uma rodada (guarda contra drenagem dupla), e é isso que este arquivo
// exercita — o outro teste do hook dubla o store.
const mocks = vi.hoisted(() => ({
  useGetStockFreezeStatus: vi.fn(),
  syncPendingQueues: vi.fn(),
  tallyPendingQueues: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStockFreezeStatus: mocks.useGetStockFreezeStatus,
}));

vi.mock("@/offline", () => ({
  readLocalDatabaseState: vi.fn().mockResolvedValue(null),
  refreshLocalDatabase: vi.fn(),
  syncPendingQueues: mocks.syncPendingQueues,
  tallyPendingQueues: mocks.tallyPendingQueues,
}));

const { useStockFreeze } = await import("../use-stock-freeze");
const { useOfflineStore } = await import("@/stores/use-offline-store");

function wrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Uma venda pendente na fila — a que o 423 manteve. */
const umaPendente = { sales: { pending: 1, failed: 0 }, writeOffs: { pending: 0, failed: 0 } };

/** Rodada recusada em lote pela conferência: nada subiu. */
const recusadaEmLote = {
  sales: { created: 0, duplicated: 0, rejected: 0, remaining: 1 },
  writeOffs: { sent: 0, rejected: 0, remaining: 0 },
  remaining: 1,
  blockedByStockFreeze: true,
};

describe("useStockFreeze — o encerramento com uma sincronização em voo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tallyPendingQueues.mockResolvedValue(umaPendente);
    useOfflineStore.setState({ online: true });
  });

  it("sobe a fila de novo depois da rodada que ainda levou 423", async () => {
    let terminarRodada: (value: typeof recusadaEmLote) => void = () => {};
    mocks.syncPendingQueues.mockImplementationOnce(
      () => new Promise((resolve) => (terminarRodada = resolve)),
    );
    mocks.syncPendingQueues.mockResolvedValue({
      sales: { created: 1, duplicated: 0, rejected: 0, remaining: 0 },
      writeOffs: { sent: 0, rejected: 0, remaining: 0 },
      remaining: 0,
      blockedByStockFreeze: false,
    });
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: true } });
    const { rerender } = renderHook(() => useStockFreeze(), { wrapper });

    // Uma rodada começa com a conferência ainda aberta (reconexão, botão
    // "Sincronizar", pedido de fechamento de caixa).
    let rodadaEmVoo: Promise<unknown> = Promise.resolve();
    await act(async () => {
      rodadaEmVoo = useOfflineStore.getState().syncNow();
      await Promise.resolve();
    });

    // A consulta de 30 s vê a conferência encerrada com a rodada em voo...
    mocks.useGetStockFreezeStatus.mockReturnValue({ data: { salesPaused: false } });
    rerender();

    // ...e a rodada em voo volta 423: o servidor a avaliou antes do encerramento.
    await act(async () => {
      terminarRodada(recusadaEmLote);
      await rodadaEmVoo;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(mocks.syncPendingQueues).toHaveBeenCalledTimes(2);
  });
});

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A prévia do cancelamento nunca vem do cache (revisão de 23/10/2026).
 *
 * O teste do hook dubla a consulta, e por isso nunca exercitou o tempo de cache:
 * aqui a consulta é a de verdade, com o `createQueryClient` do admin — o mesmo
 * padrão de 30 s da tela — e só a rede é dublada. Sem a correção, reabrir a
 * confirmação em menos de 30 s mostrava a prévia velha: "−3 un" e o botão, com
 * a unidade já vendida no meio.
 */
const mocks = vi.hoisted(() => ({ cancelPurchaseReceipt: vi.fn(), toast: vi.fn() }));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  cancelPurchaseReceipt: mocks.cancelPurchaseReceipt,
}));

const { useCancelPurchaseReceipt } = await import("../useCancelPurchaseReceipt");
const { createQueryClient } = await import("@workspace/api-client-react");

const PREVIA = {
  purchaseId: 12,
  purchaseEntryId: 40,
  canCancel: true,
  items: [{ productId: 10, productName: "BALDE", barcode: "100", quantity: 3 }],
  otherPurchaseIds: [],
};

const fetchOriginal = globalThis.fetch;
const fetchMock = vi.fn(
  async () =>
    new Response(JSON.stringify(PREVIA), { status: 200, headers: { "Content-Type": "application/json" } }),
);

/** Quantas vezes a prévia da compra 12 foi pedida ao servidor. */
const previewRequests = () =>
  fetchMock.mock.calls.filter((call) =>
    String((call as unknown[])[0]).includes("/Purchases/12/receipt-cancellation"),
  ).length;

function renderCancel() {
  const queryClient = createQueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCancelPurchaseReceipt(), { wrapper });
}

describe("useCancelPurchaseReceipt — a prévia é sempre a de agora", () => {
  beforeEach(() => {
    fetchMock.mockClear();
    mocks.cancelPurchaseReceipt.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it("reabrir a confirmação pede a prévia de novo, mesmo dentro dos 30 s do cache do admin", async () => {
    const { result } = renderCancel();

    act(() => result.current.start({ id: 12, productName: "BALDE" }));
    await waitFor(() => expect(result.current.preview?.canCancel).toBe(true));
    act(() => result.current.close());
    act(() => result.current.start({ id: 12, productName: "BALDE" }));

    await waitFor(() => expect(previewRequests()).toBe(2));
  });

  it("a recusa do servidor relê a prévia, e o botão espera por ela", async () => {
    mocks.cancelPurchaseReceipt.mockRejectedValue(
      new Error("Parte do que este recebimento trouxe já saiu do estoque."),
    );
    const { result } = renderCancel();
    act(() => result.current.start({ id: 12, productName: "BALDE" }));
    await waitFor(() => expect(result.current.preview?.canCancel).toBe(true));

    act(() => result.current.confirm());

    await waitFor(() => expect(previewRequests()).toBe(2));
    expect(mocks.cancelPurchaseReceipt).toHaveBeenCalledTimes(1);
  });
});

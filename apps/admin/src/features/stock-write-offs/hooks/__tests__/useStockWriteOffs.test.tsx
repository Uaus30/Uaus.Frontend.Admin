import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useGetStockWriteOffs: vi.fn(),
  useGetUsers: vi.fn(),
  getStockWriteOff: vi.fn(),
  registerStockWriteOff: vi.fn(),
  reverseStockWriteOff: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetStockWriteOffs: mocks.useGetStockWriteOffs,
  useGetUsers: mocks.useGetUsers,
  getStockWriteOff: mocks.getStockWriteOff,
  registerStockWriteOff: mocks.registerStockWriteOff,
  reverseStockWriteOff: mocks.reverseStockWriteOff,
  enumCode: (value: unknown) => (typeof value === "number" ? value : 0),
  SELECTABLE_STOCK_WRITE_OFF_REASONS: [1, 2, 3],
  STOCK_WRITE_OFF_REASON_LABEL: { 1: "Consumo", 2: "Perda", 3: "Doação", 4: "Inventário" },
  STOCK_WRITE_OFF_STATUS: { None: 0, Confirmed: 1, Reversed: 2 },
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useStockWriteOffs } = await import("../useStockWriteOffs");

/** Produto devolvido pela busca do modal. */
function product(id: number, name = `Produto ${id}`) {
  return { id, name, barcode: `789${id}`, stock: 50 };
}

/** Baixa da listagem: `status` 1 é efetivada, 2 é estornada. */
function writeOff(id: number, status: number) {
  return {
    id,
    status,
    reason: 2,
    occurredAt: "2026-07-25T10:00:00",
    totalQuantity: 3,
    totalCost: 30,
    userName: "Ana",
    items: [],
  } as any;
}

/** Evento de submit mínimo — o hook só chama `preventDefault`. */
const submitEvent = { preventDefault: () => {} } as unknown as React.FormEvent;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Último objeto de filtros repassado para a query da listagem. */
function lastQuery() {
  const calls = mocks.useGetStockWriteOffs.mock.calls;
  return calls[calls.length - 1][0];
}

describe("useStockWriteOffs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetStockWriteOffs.mockReturnValue({
      data: { data: [writeOff(1, 1)], page: 1, limit: 15, total: 1, totalPages: 1 },
      isLoading: false,
    });
    mocks.useGetUsers.mockReturnValue({ data: { data: [], page: 1, limit: 100, total: 0, totalPages: 0 } });
    mocks.registerStockWriteOff.mockResolvedValue({ id: 99 });
    mocks.reverseStockWriteOff.mockResolvedValue({ id: 1 });
  });

  it("deve começar sem filtro aplicado e na primeira página", () => {
    const { result } = renderHook(() => useStockWriteOffs(), { wrapper: createWrapper() });

    expect(result.current.page).toBe(1);
    expect(result.current.writeOffs).toHaveLength(1);
    expect(lastQuery()).toEqual({
      reason: undefined,
      status: undefined,
      startDate: undefined,
      endDate: undefined,
      userId: undefined,
      page: 1,
      limit: 15,
    });
  });

  it("deve voltar para a primeira página ao trocar um filtro", () => {
    const { result } = renderHook(() => useStockWriteOffs(), { wrapper: createWrapper() });

    act(() => result.current.setPage(4));
    expect(lastQuery().page).toBe(4);

    act(() => result.current.setFilter("reason", "2"));

    expect(result.current.page).toBe(1);
    expect(lastQuery()).toMatchObject({ reason: 2, page: 1 });
  });

  it("deve aplicar o período pelas duas pontas de uma vez", () => {
    const { result } = renderHook(() => useStockWriteOffs(), { wrapper: createWrapper() });

    act(() => result.current.setPage(2));
    act(() => result.current.setPeriod("2026-07-01", "2026-07-31"));

    // A data final vai com o fim do dia LOCAL para incluir o último dia do
    // período (o backend compara `OccurredAt <= endDate` com hora).
    expect(lastQuery()).toMatchObject({
      startDate: "2026-07-01",
      endDate: "2026-07-31T23:59:59",
      page: 1,
    });
  });

  it("deve limpar todos os filtros de volta ao estado neutro", () => {
    const { result } = renderHook(() => useStockWriteOffs(), { wrapper: createWrapper() });

    act(() => result.current.setFilter("userId", "7"));
    act(() => result.current.setFilter("status", "2"));
    act(() => result.current.clearFilters());

    expect(lastQuery()).toMatchObject({ userId: undefined, status: undefined });
  });

  it("deve somar o produto repetido na linha existente do rascunho", () => {
    const { result } = renderHook(() => useStockWriteOffs(), { wrapper: createWrapper() });

    act(() => result.current.addDraftItem(product(5), 2));
    act(() => result.current.addDraftItem(product(9), 1));
    act(() => result.current.addDraftItem(product(5), 3));

    expect(result.current.draftItems).toHaveLength(2);
    expect(result.current.draftItems[0]).toMatchObject({ productId: 5, quantity: 5 });
    expect(result.current.draftTotalQuantity).toBe(6);
  });

  it("deve ajustar e remover linhas do rascunho", () => {
    const { result } = renderHook(() => useStockWriteOffs(), { wrapper: createWrapper() });

    act(() => result.current.addDraftItem(product(5), 1));
    act(() => result.current.updateDraftItemQuantity(5, 8));
    expect(result.current.draftTotalQuantity).toBe(8);

    act(() => result.current.removeDraftItem(5));
    expect(result.current.draftItems).toEqual([]);
    expect(result.current.draftTotalQuantity).toBe(0);
  });

  it("deve registrar a baixa com o rascunho consolidado e limpar o formulário", async () => {
    const { result } = renderHook(() => useStockWriteOffs(), { wrapper: createWrapper() });

    act(() => result.current.openRegisterModal());
    act(() => result.current.setDraftReason("2"));
    act(() => result.current.addDraftItem(product(5), 2));
    act(() => result.current.addDraftItem(product(5), 1));
    act(() => result.current.setDraftNotes("  Quebrou na gôndola  "));

    await act(async () => {
      result.current.handleRegisterSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.registerStockWriteOff).toHaveBeenCalledWith({
        reason: 2,
        items: [{ productId: 5, quantity: 3 }],
        notes: "Quebrou na gôndola",
      }),
    );
    await waitFor(() => expect(result.current.registerModalOpen).toBe(false));
    expect(result.current.draftItems).toEqual([]);
    expect(result.current.draftReason).toBe("");
  });

  it("deve avisar sem chamar a API quando falta o motivo", async () => {
    const { result } = renderHook(() => useStockWriteOffs(), { wrapper: createWrapper() });

    act(() => result.current.addDraftItem(product(5), 1));
    await act(async () => {
      result.current.handleRegisterSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Selecione o motivo da baixa.",
          variant: "destructive",
        }),
      ),
    );
    expect(mocks.registerStockWriteOff).not.toHaveBeenCalled();
  });

  it("deve levar o erro do backend legível até o toast", async () => {
    // Formato real do `ApiError`: a frase do backend já vem em `message`.
    mocks.registerStockWriteOff.mockRejectedValue(
      Object.assign(new Error("Estoque insuficiente para baixa do produto #5"), {
        status: 400,
        payload: { message: "Estoque insuficiente para baixa do produto #5" },
      }),
    );

    const { result } = renderHook(() => useStockWriteOffs(), { wrapper: createWrapper() });

    act(() => result.current.setDraftReason("2"));
    act(() => result.current.addDraftItem(product(5), 1));
    await act(async () => {
      result.current.handleRegisterSubmit(submitEvent);
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Erro ao registrar a baixa",
          description: "Estoque insuficiente para baixa do produto #5",
          variant: "destructive",
        }),
      ),
    );
  });

  it("não deve abrir o estorno de uma baixa já estornada", () => {
    const { result } = renderHook(() => useStockWriteOffs(), { wrapper: createWrapper() });

    act(() => result.current.openReversal(writeOff(1, 2)));

    expect(result.current.reversalTarget).toBeNull();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Esta baixa já foi estornada" }),
    );
  });

  it("deve estornar a baixa efetivada com o motivo informado", async () => {
    const { result } = renderHook(() => useStockWriteOffs(), { wrapper: createWrapper() });

    act(() => result.current.openReversal(writeOff(1, 1)));
    expect(result.current.reversalTarget).not.toBeNull();

    act(() => result.current.setReversalReason("Lançado em duplicidade"));
    await act(async () => {
      result.current.confirmReversal();
    });

    await waitFor(() => expect(mocks.reverseStockWriteOff).toHaveBeenCalledWith(1, "Lançado em duplicidade"));
    await waitFor(() => expect(result.current.reversalTarget).toBeNull());
  });
});

import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductSearchOption } from "@/components/product-search-option";
import { useNewSaleDraft } from "../useNewSaleDraft";

const mocks = vi.hoisted(() => ({
  createCompleteSale: vi.fn(() => Promise.resolve(99)),
  toast: vi.fn(),
  closings: [] as Array<{ id: number; periodStart: string; periodEnd: string }>,
  useGetStockCorrections: vi.fn((_ids: number[], _since: string | null) => ({
    data: undefined as Array<{ productId: number; lastCorrectedAt: string }> | undefined,
  })),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  createCompleteSale: mocks.createCompleteSale,
  useGetFinancialClosings: () => ({ data: { data: mocks.closings } }),
  useGetStockCorrections: mocks.useGetStockCorrections,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

function produto(id: number, price: number, stock = 10): ProductSearchOption {
  return { id, productGroupId: id, name: `PRODUTO ${id}`, barcode: null, stock, price, costPrice: 1 };
}

function renderDraft(methods: Array<{ id: number; isActive?: boolean }> = [{ id: 1 }, { id: 2 }]) {
  const onSaved = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useNewSaleDraft(methods, onSaved), { wrapper });
  act(() => view.result.current.reset());
  return { ...view, onSaved };
}

describe("useNewSaleDraft — a Nova venda do painel (06/10/2026)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 6, 15, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.closings = [];
  });

  it("produto contado depois da data escolhida vem marcado; sem mexer na data, nem pergunta", () => {
    // Decisão do dono (06/10/2026): o aviso é do produto, com a data da contagem.
    mocks.useGetStockCorrections.mockImplementation((_ids, since) => ({
      data: since ? [{ productId: 1, lastCorrectedAt: "2026-10-05T09:00:00" }] : undefined,
    }));
    const { result } = renderDraft();
    act(() => result.current.addProduct(produto(1, 10)));

    expect(mocks.useGetStockCorrections).toHaveBeenLastCalledWith([1], null);
    expect(result.current.stockCorrections).toEqual({});

    act(() => result.current.setWhen({ date: "2026-10-04", time: "15:20" }));
    expect(mocks.useGetStockCorrections).toHaveBeenLastCalledWith([1], "2026-10-04T15:20:00");
    expect(result.current.stockCorrections).toEqual({ 1: "2026-10-05T09:00:00" });
  });

  it("data em mês com fechamento financeiro é aceita, com aviso antes e depois de gravar", async () => {
    // Decisão do dono (06/10/2026, opção b): permitir e avisar que o fechamento
    // fica desatualizado. Até então a venda era recusada.
    mocks.closings = [{ id: 3, periodStart: "2026-09-01T00:00:00", periodEnd: "2026-09-30T00:00:00" }];
    const { result } = renderDraft();
    act(() => result.current.addProduct(produto(1, 10)));

    expect(result.current.closedPeriodNotice).toBeNull();
    act(() => result.current.setWhen({ date: "2026-09-30", time: "18:00" }));
    expect(result.current.closedPeriodNotice).toContain("de 01/09/2026 a 30/09/2026");

    await act(() => result.current.submit());
    expect(mocks.createCompleteSale).toHaveBeenCalledWith(
      expect.objectContaining({ occurredAt: "2026-09-30T18:00:00" }),
    );
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Venda registrada.",
        description: expect.stringContaining("desatualizado"),
      }),
    );
  });

  it("o mesmo produto de novo soma uma unidade; total com desconto; tirar o item zera", () => {
    const { result } = renderDraft();

    act(() => result.current.addProduct(produto(1, 10)));
    act(() => result.current.addProduct(produto(1, 10)));
    act(() => result.current.addProduct(produto(2, 5.5)));
    expect(result.current.items.map((item) => [item.productId, item.quantity])).toEqual([
      [1, 2],
      [2, 1],
    ]);
    expect(result.current.subtotal).toBe(25.5);

    act(() => result.current.setDiscount(5));
    expect(result.current.total).toBe(20.5);

    act(() => result.current.removeItem(1));
    expect(result.current.total).toBe(0.5);
  });

  it("o preço do item se edita, e com uma forma só o pagamento acompanha o total", () => {
    const { result } = renderDraft();

    act(() => result.current.addProduct(produto(1, 10)));
    act(() => result.current.updateItem(1, { unitPrice: 12, quantity: 3 }));

    expect(result.current.total).toBe(36);
    expect(result.current.payments).toEqual([{ paymentMethodId: 1, amount: 36 }]);
    expect(result.current.remainingAmount).toBe(0);
  });

  it("dividir em outra forma entra com o que falta, e trocar a forma zera parcelas e taxa", () => {
    const { result } = renderDraft();
    act(() => result.current.addProduct(produto(1, 100)));
    act(() => result.current.updatePayment(0, { amount: 60, installments: 3, transactionFee: 2 }));

    // Com uma forma só o valor volta ao total; dividindo, a segunda entra com o resto.
    act(() => result.current.addPayment());
    act(() => result.current.updatePayment(0, { amount: 60 }));
    act(() => result.current.updatePayment(1, { amount: 40 }));
    expect(result.current.payments.map((payment) => payment.paymentMethodId)).toEqual([1, 2]);
    expect(result.current.remainingAmount).toBe(0);

    act(() => result.current.updatePayment(0, { paymentMethodId: 3 }));
    expect(result.current.payments[0]).toEqual({ paymentMethodId: 3, amount: 60 });
  });

  it("a forma padrão e a forma acrescentada são ATIVAS, mesmo com uma desativada antes na lista", () => {
    // A lista da API vem em ordem de nome com as desativadas junto; a primeira da
    // lista virava a forma padrão, e o servidor recusava a venda.
    const { result } = renderDraft([
      { id: 1, isActive: false },
      { id: 2 },
      { id: 3, isActive: false },
      { id: 4 },
    ]);
    act(() => result.current.addProduct(produto(1, 10)));

    expect(result.current.payments[0].paymentMethodId).toBe(2);
    act(() => result.current.addPayment());
    expect(result.current.payments.map((payment) => payment.paymentMethodId)).toEqual([2, 4]);
  });

  it("sem mexer na data, a venda vai sem occurredAt — é 'agora' no servidor", async () => {
    const { result, onSaved } = renderDraft();
    act(() => result.current.addProduct(produto(1, 10)));

    await act(() => result.current.submit());

    expect(mocks.createCompleteSale).toHaveBeenCalledWith(
      expect.objectContaining({ occurredAt: null, items: [{ productId: 1, quantity: 1, unitPrice: 10 }] }),
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("venda de outro dia vai com a data no horário da loja, sem fuso, e avisa que é retroativa", async () => {
    const { result } = renderDraft();
    act(() => result.current.addProduct(produto(1, 10)));
    act(() => result.current.setWhen({ date: "2026-10-04", time: "15:20" }));

    expect(result.current.isBackdated).toBe(true);
    await act(() => result.current.submit());

    expect(mocks.createCompleteSale).toHaveBeenCalledWith(
      expect.objectContaining({ occurredAt: "2026-10-04T15:20:00" }),
    );
  });

  it("data no futuro e venda sem produto não vão para o servidor", async () => {
    const { result } = renderDraft();

    await act(() => result.current.submit());
    act(() => result.current.addProduct(produto(1, 10)));
    act(() => result.current.setWhen({ date: "2026-10-06", time: "18:00" }));
    await act(() => result.current.submit());

    expect(mocks.createCompleteSale).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Adicione pelo menos um produto." }),
    );
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "A data da venda não pode ser no futuro." }),
    );
  });
});

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SaleDto } from "@workspace/api-client-react";
import { useEditSaleHeader } from "../useEditSaleHeader";

const mocks = vi.hoisted(() => ({
  updateSaleHeader: vi.fn(() => Promise.resolve(null)),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  updateSaleHeader: mocks.updateSaleHeader,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

/** Venda do PDV: cartão em 3x com taxa, total R$ 90. */
const venda = {
  id: 1945,
  createdAt: "2026-10-05T14:32:10",
  total: 90,
  discount: 0,
  customerId: 7,
  notes: "embrulhar",
  paymentStatus: 2,
  payments: [
    {
      id: 1,
      saleId: 1945,
      paymentMethodId: 4,
      paymentMethodInstallmentId: 11,
      amount: 90,
      installments: 3,
      transactionFee: 2.7,
      sequence: 1,
    },
  ],
} as unknown as SaleDto;

function renderEdit(methods: Array<{ id: number; isActive?: boolean }> = [{ id: 4 }, { id: 5 }]) {
  const onSaved = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(() => useEditSaleHeader(venda, methods, onSaved), { wrapper });
  return { ...view, onSaved, client };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useEditSaleHeader — corrigir a venda registrada (06/10/2026)", () => {
  it("começa do que está gravado, com a hora da API cortada da string", async () => {
    const { result } = renderEdit();

    await waitFor(() => expect(result.current.when).toEqual({ date: "2026-10-05", time: "14:32" }));
    expect(result.current.customerId).toBe(7);
    expect(result.current.notes).toBe("embrulhar");
  });

  it("corrigir só a observação devolve a forma com parcelas, parcelamento e taxa intactos", async () => {
    // Sem eles o servidor entenderia que a forma mudou — e numa venda de caixa
    // fechado recusaria a correção só da observação.
    const { result, onSaved, client } = renderEdit();
    await waitFor(() => expect(result.current.payments).toHaveLength(1));
    // O detalhe que estava aberto antes da correção, com a observação velha.
    client.setQueryData(["sale-details", 1945], venda);

    act(() => result.current.setNotes("embrulhar para presente"));
    await act(() => result.current.submit());

    expect(mocks.updateSaleHeader).toHaveBeenCalledWith(1945, {
      occurredAt: "2026-10-05T14:32:00",
      customerId: 7,
      notes: "embrulhar para presente",
      payments: [
        {
          paymentMethodId: 4,
          amount: 90,
          installments: 3,
          paymentMethodInstallmentId: 11,
          transactionFee: 2.7,
        },
      ],
    });
    expect(onSaved).toHaveBeenCalled();
    // Descartado, e não só invalidado: ao reabrir, o detalhe não pode mostrar a
    // versão velha — "Corrigir venda" nela desfaria a correção.
    expect(client.getQueryData(["sale-details", 1945])).toBeUndefined();
  });

  it("dividir em outra forma escolhe uma ATIVA, nunca a desativada", async () => {
    const { result } = renderEdit([{ id: 4 }, { id: 6, isActive: false }, { id: 5 }]);
    await waitFor(() => expect(result.current.payments).toHaveLength(1));

    act(() => result.current.addPayment());

    expect(result.current.payments.map((payment) => payment.paymentMethodId)).toEqual([4, 5]);
  });

  it("sem mexer na data, o relógio do celular atrasado não trava a correção", async () => {
    // Venda das 14:32 no PDV; o celular marca 14:31. A data não foi mexida, então
    // não há "futuro" a recusar — quem confere a data é o servidor.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 5, 14, 31, 0));
    const { result } = renderEdit();
    await waitFor(() => expect(result.current.payments).toHaveLength(1));
    expect(result.current.dateChanged).toBe(false);

    await act(() => result.current.submit());
    expect(mocks.updateSaleHeader).toHaveBeenCalledTimes(1);

    // Mexendo na data para o futuro, a tela recusa antes do servidor.
    act(() => result.current.setWhen({ date: "2026-10-05", time: "18:00" }));
    expect(result.current.dateChanged).toBe(true);
    await act(() => result.current.submit());
    expect(mocks.updateSaleHeader).toHaveBeenCalledTimes(1);
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "A data da venda não pode ser no futuro." }),
    );
  });

  it("a recusa do servidor vira o toast com a frase dele, e a modal fica aberta", async () => {
    const { result, onSaved } = renderEdit();
    await waitFor(() => expect(result.current.payments).toHaveLength(1));
    mocks.updateSaleHeader.mockRejectedValueOnce(new Error("O caixa desta venda já foi fechado"));

    await act(() => result.current.submit());

    expect(onSaved).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});

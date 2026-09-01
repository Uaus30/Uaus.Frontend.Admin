import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cancelSaleRequest = vi.fn();
const getSaleItems = vi.fn();
const restoreCancelledSaleStock = vi.fn();
const apiGet = vi.fn();
const printReceipt = vi.fn();
const toast = vi.fn();

vi.mock("@/services/sales.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/sales.service")>()),
  cancelSale: (...args: unknown[]) => cancelSaleRequest(...args),
  getSaleItems: (...args: unknown[]) => getSaleItems(...args),
  restoreCancelledSaleStock: (...args: unknown[]) => restoreCancelledSaleStock(...args),
}));

// `enumCode` e `PAYMENT_STATUS` continuam os de verdade: é com eles que o hook
// decide se o cupom sai carimbado como venda cancelada.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  apiGet: (...args: unknown[]) => apiGet(...args),
}));

vi.mock("@workspace/receipt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/receipt")>()),
  printReceipt: (...args: unknown[]) => printReceipt(...args),
}));

vi.mock("@workspace/ui", () => ({
  useToast: () => ({ toast }),
}));

import { PAYMENT_STATUS } from "@workspace/api-client-react";

const { useSaleHistoryActions } = await import("../use-sale-history-actions");
const { usePdvStore } = await import("@/stores/use-pdv-store");

/** Venda registrada de referência: R$ 16,00, um item, paga em dinheiro. */
const SALE = {
  id: 42,
  createdAt: "2026-08-15T12:00:00",
  total: 16,
  discount: 1,
  paymentStatus: PAYMENT_STATUS.Paid,
  payments: [{ paymentMethodId: 1, paymentMethodName: "Dinheiro", amount: 16 }],
} as unknown as Parameters<ReturnType<typeof useSaleHistoryActions>["cancelSale"]>[0];

/** Item vendido a R$ 8,00 com R$ 2,00 de desconto — tabela de R$ 10,00. */
const SALE_ITEM = {
  id: 501,
  productId: 7,
  productName: "Coca-Cola 350ml",
  quantity: 2,
  unitPrice: 8,
  discount: 2,
  barcode: "7891000100103",
};

const onSaleChanged = vi.fn();
const onSaleLoadedForEditing = vi.fn();

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function render() {
  return renderHook(
    () =>
      useSaleHistoryActions({
        paymentMethodNameById: { 1: "Dinheiro" },
        companySettings: { usesCashRegister: true },
        onSaleChanged,
        onSaleLoadedForEditing,
      }),
    { wrapper: createWrapper() },
  );
}

describe("useSaleHistoryActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePdvStore.setState({ items: [], globalDiscount: 0, editingSaleId: null, status: "IDLE" });
    getSaleItems.mockResolvedValue([SALE_ITEM]);
    apiGet.mockResolvedValue({
      id: 7,
      name: "Coca-Cola 350ml",
      barcode: "789",
      price: 12,
      stock: 4,
      imageUrl: "produtos/coca-350.png",
    });
    cancelSaleRequest.mockResolvedValue(undefined);
    restoreCancelledSaleStock.mockResolvedValue(undefined);
    printReceipt.mockResolvedValue(undefined);
  });

  it("deve pedir confirmação antes de cancelar a venda", async () => {
    // Cancelar devolve estoque e apaga faturamento, e não tem desfazer: um toque
    // errado na lista do balcão apagava a venda sem perguntar nada.
    const { result } = render();

    act(() => result.current.cancelSale(SALE));

    expect(result.current.pendingSaleToCancel?.id).toBe(42);
    expect(cancelSaleRequest).not.toHaveBeenCalled();

    act(() => result.current.dismissCancelSale());

    expect(result.current.pendingSaleToCancel).toBeNull();
    expect(cancelSaleRequest).not.toHaveBeenCalled();
  });

  it("deve cancelar a venda e devolver o estoque na projeção local", async () => {
    const { result } = render();

    act(() => result.current.cancelSale(SALE));
    await act(() => result.current.confirmCancelSale());

    expect(cancelSaleRequest).toHaveBeenCalledWith(42, "Cancelada no PDV");
    expect(restoreCancelledSaleStock).toHaveBeenCalledWith(42);
    expect(onSaleChanged).toHaveBeenCalled();
    expect(result.current.busySaleId).toBeNull();
  });

  it("não deve derrubar o cancelamento quando a base local não aceita a devolução", async () => {
    restoreCancelledSaleStock.mockRejectedValue(new Error("base bloqueada"));

    const { result } = render();
    act(() => result.current.cancelSale(SALE));
    await act(() => result.current.confirmCancelSale());

    // A venda foi cancelada no servidor; a projeção se corrige no próximo snapshot.
    expect(onSaleChanged).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Venda cancelada" }));
  });

  it("deve avisar quando o servidor recusa o cancelamento", async () => {
    cancelSaleRequest.mockRejectedValue(new Error("venda já cancelada"));

    const { result } = render();
    act(() => result.current.cancelSale(SALE));
    await act(() => result.current.confirmCancelSale());

    expect(onSaleChanged).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Não foi possível cancelar", variant: "destructive" }),
    );
  });

  it("deve reimprimir o cupom como segunda via", async () => {
    const { result } = render();

    await act(() => result.current.printSaleReceipt(SALE));

    expect(getSaleItems).toHaveBeenCalledWith(42);
    expect(printReceipt).toHaveBeenCalledWith(expect.objectContaining({ reprint: true, saleId: 42 }));
  });

  it("deve reimprimir o cupom de venda cancelada com itens e carimbo de cancelada", async () => {
    const cancelledSale = { ...SALE, paymentStatus: PAYMENT_STATUS.Cancelled };
    const { result } = render();

    await act(() => result.current.printSaleReceipt(cancelledSale));

    expect(getSaleItems).toHaveBeenCalledWith(42);
    expect(printReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        reprint: true,
        cancelled: true,
        saleId: 42,
        items: expect.arrayContaining([
          expect.objectContaining({ name: "Coca-Cola 350ml", quantity: 2, unitPrice: 8 }),
        ]),
      }),
    );
  });

  it("deve reabrir a venda no carrinho com o preço de tabela da própria venda", async () => {
    const { result } = render();

    await act(async () => {
      result.current.editSale(SALE);
    });

    const state = usePdvStore.getState();
    expect(state.editingSaleId).toBe(42);
    // unitPrice + discount reconstrói os R$ 10,00 do dia da venda — e não os
    // R$ 12,00 que o produto custa hoje no cadastro.
    expect(state.items[0].price).toBe(10);
    expect(state.items[0].discount).toBe(2);
    // O estoque de hoje não contém as unidades desta venda.
    expect(state.items[0].availableStock).toBe(6);
    expect(state.globalDiscount).toBe(1);
    expect(onSaleLoadedForEditing).toHaveBeenCalled();
  });

  it("deve trazer a foto do produto para o carrinho da reedição", async () => {
    // A venda gravada não guarda foto; ela vem do cadastro, por `/Products/{id}`.
    // Sem o campo no DTO, a reedição mostrava o ícone de "sem imagem" em produto
    // que tem imagem — e o operador conferia o carrinho sem a pista visual que
    // usa no bipe.
    const { result } = render();

    await act(async () => {
      result.current.editSale(SALE);
    });

    expect(usePdvStore.getState().items[0].imageUrl).toBe("produtos/coca-350.png");
  });

  it("deve reabrir a venda sem foto quando a consulta do produto falha", async () => {
    // A consulta do cadastro é tolerante a erro de propósito: perder a foto não
    // pode impedir a reedição da venda.
    apiGet.mockRejectedValue(new Error("500"));

    const { result } = render();

    await act(async () => {
      result.current.editSale(SALE);
    });

    const state = usePdvStore.getState();
    expect(state.editingSaleId).toBe(42);
    expect(state.items[0].imageUrl).toBeNull();
  });

  it("deve pedir confirmação antes de descartar um carrinho em andamento", async () => {
    usePdvStore.setState({
      items: [
        {
          id: "linha-1",
          productId: 3,
          name: "Guaraná",
          price: 5,
          quantity: 1,
          discount: 0,
          availableStock: 9,
        },
      ],
    });

    const { result } = render();

    await act(async () => {
      result.current.editSale(SALE);
    });

    expect(result.current.isConfirmDiscardOpen).toBe(true);
    expect(getSaleItems).not.toHaveBeenCalled();

    await act(async () => {
      result.current.confirmDiscardAndEdit();
    });

    expect(usePdvStore.getState().editingSaleId).toBe(42);
    expect(result.current.isConfirmDiscardOpen).toBe(false);
  });

  it("deve avisar quando não consegue carregar a venda para edição", async () => {
    getSaleItems.mockRejectedValue(new Error("500"));

    const { result } = render();
    await act(async () => {
      result.current.editSale(SALE);
    });

    expect(usePdvStore.getState().editingSaleId).toBeNull();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Não foi possível carregar a venda" }),
    );
  });
});

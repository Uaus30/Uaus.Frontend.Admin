import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COUPON_DISCOUNT_TYPE } from "@workspace/api-client-react";

const registerSale = vi.fn();
const updateSale = vi.fn();
const printReceipt = vi.fn();
const toast = vi.fn();

// Só a rede e a impressora são dubladas: `LocalStockError` precisa ser a classe
// de verdade, senão o `instanceof` do hook nunca reconheceria a recusa local.
vi.mock("@/services/sales.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/sales.service")>()),
  registerSale: (...args: unknown[]) => registerSale(...args),
  updateSale: (...args: unknown[]) => updateSale(...args),
}));

vi.mock("@workspace/receipt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/receipt")>()),
  printReceipt: (...args: unknown[]) => printReceipt(...args),
}));

vi.mock("@workspace/ui", () => ({
  useToast: () => ({ toast }),
}));

const { useSaleCheckout } = await import("../use-sale-checkout");
const { usePdvStore } = await import("@/stores/use-pdv-store");
// `computeSaleTotal` é a função DE VERDADE (o mock preserva o resto do módulo):
// é a mesma conta que o servidor refaz para conferir a venda.
const { LocalStockError, computeSaleTotal } = await import("@/services/sales.service");
const { resolveCashRegisterMode } = await import("@/lib/cash-register-mode");

const DINHEIRO = {
  id: 1,
  createdAt: "",
  updatedAt: null,
  name: "Dinheiro",
  isActive: true,
  installments: [{ id: 10, paymentMethodId: 1, installmentNumber: 1, feePercentage: 0, isActive: true }],
};

const CART_ITEM = {
  id: "linha-1",
  productId: 7,
  name: "Coca-Cola 350ml",
  barcode: "7891000100103",
  price: 10,
  quantity: 2,
  discount: 2,
  availableStock: 5,
};

/** Cupom de 10% do panfleto, com uma pergunta respondida no balcão. */
const CUPOM_10 = {
  couponId: 7,
  code: "10OFFSET26",
  description: "Panfleto de setembro",
  discountType: COUPON_DISCOUNT_TYPE.Percentage,
  discountValue: 10,
  answers: [{ questionId: 3, optionId: 21 }],
};

const setPayments = vi.fn();
const setSplitPayment = vi.fn();
const setAmountReceived = vi.fn();

/** Checkout com uma forma escolhida e R$ 20,00 recebidos em dinheiro. */
const checkout = {
  payments: [{ paymentMethodId: 1, amount: 16, installmentNumber: 1 }],
  receivedAmount: 20,
  change: 4,
  setPayments,
  setSplitPayment,
  setAmountReceived,
} as unknown as Parameters<typeof useSaleCheckout>[0]["checkout"];

const onSaleRecorded = vi.fn();
const onSaleFinished = vi.fn();
const focusSearch = vi.fn();

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

/** Renderiza o hook com o cenário padrão: loja com caixa aberto e online. */
function render(overrides: Partial<Parameters<typeof useSaleCheckout>[0]> = {}) {
  return renderHook(
    (props: Partial<Parameters<typeof useSaleCheckout>[0]>) =>
      useSaleCheckout({
        checkout,
        paymentMethods: [DINHEIRO],
        paymentMethodNameById: { 1: "Dinheiro" },
        total: 16,
        sessionId: 3,
        mode: resolveCashRegisterMode({ usesCashRegister: true }),
        online: true,
        hasLocalDatabase: true,
        operatorName: "Ana",
        companySettings: { usesCashRegister: true },
        onSaleRecorded,
        onSaleFinished,
        focusSearch,
        ...overrides,
        ...props,
      }),
    { wrapper: createWrapper(), initialProps: {} },
  );
}

describe("useSaleCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePdvStore.setState({
      status: "CHECKOUT",
      items: [CART_ITEM],
      globalDiscount: 0,
      // Explícito: `setState` faz merge, e sem zerar aqui o cupom do teste
      // anterior vazaria para os demais casos.
      coupon: null,
      consumer: { customerId: null, name: "", document: "" },
      editingSaleId: null,
      saleClientReference: null,
    });
    registerSale.mockResolvedValue({
      id: 42,
      receiptNumber: 42,
      clientReference: "ref",
      occurredAt: "2026-08-15T12:00:00",
      total: 16,
      notes: null,
      offline: false,
    });
    printReceipt.mockResolvedValue(undefined);
  });

  it("deve gravar a venda, zerar o carrinho e imprimir o cupom", async () => {
    const { result } = render();

    await act(() => result.current.confirmPayment());

    expect(registerSale).toHaveBeenCalledTimes(1);
    const [payload] = registerSale.mock.calls[0];
    expect(payload.items[0].unitPrice).toBe(8);
    expect(payload.cashRegisterSessionId).toBe(3);

    // A venda chegou ao servidor: histórico e resumo do caixa precisam recarregar.
    expect(onSaleRecorded).toHaveBeenCalled();
    expect(usePdvStore.getState().items).toEqual([]);
    expect(onSaleFinished).toHaveBeenCalled();
    expect(printReceipt).toHaveBeenCalledWith(expect.objectContaining({ saleId: 42, total: 16 }));
  });

  it("deve levar o cupom aplicado para a venda e para o impresso", async () => {
    usePdvStore.setState({ coupon: CUPOM_10 });

    // O total que o carrinho MOSTRA — não um literal. O checkout cobra este
    // valor, e é contra ele que a venda gravada tem que fechar.
    const totalNaTela = usePdvStore.getState().getTotal();

    const { result } = render({
      total: totalNaTela,
      checkout: {
        ...checkout,
        payments: [{ paymentMethodId: 1, amount: totalNaTela, installmentNumber: 1 }],
      } as typeof checkout,
    });

    await act(() => result.current.confirmPayment());

    const [payload] = registerSale.mock.calls[0];

    // A regressão: o cupom ficava de fora do payload, o `discount` subia só com o
    // desconto global e o total derivado dele não fechava com o que o cliente
    // pagou — o servidor recusava a venda com o cliente no balcão.
    expect(computeSaleTotal(payload.items, payload.discount)).toBe(totalNaTela);

    // O cupom é PARCELA do desconto total, nunca uma adição.
    expect(payload.coupon).toMatchObject({
      couponId: 7,
      code: "10OFFSET26",
      discountAmount: payload.discount,
      answers: [{ questionId: 3, optionId: 21 }],
    });

    // No papel o cupom sai discriminado, com o mesmo abatimento que foi gravado.
    expect(printReceipt).toHaveBeenCalledWith(
      expect.objectContaining({
        coupon: expect.objectContaining({ code: "10OFFSET26", amount: payload.discount }),
      }),
    );
  });

  it("deve imprimir o cupom em toda venda, sem preferência para desligar", async () => {
    // A preferência "imprimir ao finalizar" saiu das Preferências em 01/09/2026:
    // ela duplicava a decisão que a própria caixa de impressão do navegador já
    // oferece, e desligada fazia o operador achar que a impressora falhou.
    const { result } = render();
    await act(() => result.current.confirmPayment());

    expect(printReceipt).toHaveBeenCalledTimes(1);
    expect(focusSearch).toHaveBeenCalled();
  });

  it("não deve recarregar o histórico de uma venda que ficou na fila", async () => {
    registerSale.mockResolvedValue({
      id: null,
      receiptNumber: "OFF-3",
      clientReference: "ref",
      occurredAt: "2026-08-15T12:00:00",
      total: 16,
      notes: null,
      offline: true,
    });

    const { result } = render({ online: false });
    await act(() => result.current.confirmPayment());

    expect(onSaleRecorded).not.toHaveBeenCalled();
    expect(registerSale).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ offline: true }));
    expect(printReceipt).toHaveBeenCalledWith(expect.objectContaining({ offline: true, saleId: "OFF-3" }));
  });

  it("deve recusar a venda sem caixa aberto quando a loja usa controle de caixa", async () => {
    const { result } = render({ sessionId: null });

    await act(() => result.current.confirmPayment());

    expect(registerSale).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Caixa fechado" }));
    // O carrinho continua de pé para o operador abrir o caixa e confirmar de novo.
    expect(usePdvStore.getState().items).toHaveLength(1);
  });

  it("deve recusar a reedição sem conexão", async () => {
    usePdvStore.setState({ editingSaleId: 9 });

    const { result } = render({ online: false });
    await act(() => result.current.confirmPayment());

    expect(updateSale).not.toHaveBeenCalled();
    expect(registerSale).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Sem conexão para editar" }));
  });

  it("deve recusar a venda offline sem base local", async () => {
    const { result } = render({ online: false, hasLocalDatabase: false });

    await act(() => result.current.confirmPayment());

    expect(registerSale).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Base local indisponível" }));
  });

  it("deve regravar a mesma venda numa reedição", async () => {
    usePdvStore.setState({ editingSaleId: 9 });
    updateSale.mockResolvedValue({
      id: 9,
      createdAt: "2026-08-10T10:00:00",
      total: 16,
      notes: null,
      customerDocument: null,
    });

    const { result } = render();
    await act(() => result.current.confirmPayment());

    expect(updateSale).toHaveBeenCalledWith(9, expect.anything());
    expect(registerSale).not.toHaveBeenCalled();
    // Segunda via: o cupom da reedição sai carimbado.
    expect(printReceipt).toHaveBeenCalledWith(expect.objectContaining({ reprint: true }));
  });

  it("deve explicar as faltas quando a base local recusa a venda", async () => {
    registerSale.mockRejectedValue(
      new LocalStockError([{ productId: 7, productName: "Coca-Cola 350ml", requested: 2, available: 1 }]),
    );

    const { result } = render();
    await act(() => result.current.confirmPayment());

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Estoque insuficiente na base local",
        description: expect.stringContaining("Coca-Cola 350ml"),
      }),
    );
    // Nada foi zerado: a venda não aconteceu.
    expect(usePdvStore.getState().items).toHaveLength(1);
    expect(result.current.savingSale).toBe(false);
  });

  it("deve reutilizar a chave de idempotência entre tentativas do mesmo checkout", async () => {
    registerSale.mockRejectedValueOnce(new Error("504"));

    const { result } = render();
    await act(() => result.current.confirmPayment());
    await act(() => result.current.confirmPayment());

    const first = registerSale.mock.calls[0][1].clientReference;
    const second = registerSale.mock.calls[1][1].clientReference;
    // Chave nova a cada clique faria o servidor gravar uma segunda venda idêntica.
    expect(second).toBe(first);
  });

  it("deve inicializar o pagamento uma única vez por checkout", () => {
    const { rerender } = render();

    expect(setPayments).toHaveBeenCalledWith([{ paymentMethodId: 1, amount: 16, installmentNumber: 1 }]);
    setPayments.mockClear();

    // Um refetch de /PaymentMethods troca a identidade do array; a escolha do
    // operador não pode ser sobrescrita por causa disso.
    rerender({ paymentMethods: [{ ...DINHEIRO }] });

    expect(setPayments).not.toHaveBeenCalled();
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReceiptData } from "@workspace/receipt";

const mocks = vi.hoisted(() => ({ printReceipt: vi.fn(() => Promise.resolve()) }));

vi.mock("@workspace/receipt", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/receipt")>()),
  printReceipt: mocks.printReceipt,
}));

const { useReceiptPrinter } = await import("../use-receipt-printer");
const { useReceiptShare } = await import("../use-receipt-share");

const RECEIPT: ReceiptData = {
  saleId: 321,
  createdAt: "2026-10-07T15:00:00",
  items: [{ name: "CANECA", quantity: 1, unitPrice: 25 }],
  payments: [{ name: "Pix", amount: 25 }],
  total: 25,
};

const original = { width: window.innerWidth, height: window.innerHeight };
function resizeTo(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", { configurable: true, value: height });
}

describe("useReceiptPrinter", () => {
  afterEach(() => {
    resizeTo(original.width, original.height);
    useReceiptShare.getState().close();
    mocks.printReceipt.mockClear();
  });

  it("no balcão, imprime", async () => {
    resizeTo(1366, 768);
    const { result } = renderHook(() => useReceiptPrinter());

    await act(() => result.current.sendReceiptToPrinter(RECEIPT, { customerPhone: "44999990001" }));

    expect(mocks.printReceipt).toHaveBeenCalledWith(RECEIPT);
    expect(useReceiptShare.getState().request).toBeNull();
  });

  it.each([
    ["deitado", 844, 390],
    ["em pé", 390, 844],
  ])("no celular %s, não imprime: oferece o WhatsApp para o cliente da venda", async (_, width, height) => {
    // Decisão do dono (07/10/2026): no celular não há impressora, o comprovante
    // sai só pelo WhatsApp.
    resizeTo(width, height);
    const { result } = renderHook(() => useReceiptPrinter());

    await act(() => result.current.sendReceiptToPrinter(RECEIPT, { customerPhone: "44999990001" }));

    expect(mocks.printReceipt).not.toHaveBeenCalled();
    expect(useReceiptShare.getState().request).toEqual({ receipt: RECEIPT, customerPhone: "44999990001" });
  });

  it("sem cliente na venda, o pedido vai sem telefone", async () => {
    resizeTo(844, 390);
    const { result } = renderHook(() => useReceiptPrinter());

    await act(() => result.current.sendReceiptToPrinter(RECEIPT));

    expect(useReceiptShare.getState().request?.customerPhone).toBeNull();
  });
});

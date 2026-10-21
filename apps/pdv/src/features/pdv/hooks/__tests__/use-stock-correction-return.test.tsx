import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePdvStore } from "@/stores/use-pdv-store";
import { useStockCorrectionStore } from "../../lib/stock-correction";

const mocks = vi.hoisted(() => ({
  searchPdvProducts: vi.fn(),
  refreshLocalStock: vi.fn(async () => undefined),
  toast: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  searchPdvProducts: mocks.searchPdvProducts,
}));

vi.mock("@/offline", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/offline")>()),
  refreshLocalStock: mocks.refreshLocalStock,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useStockCorrectionReturn } = await import("../use-stock-correction-return");

const CANECA = { id: 7, name: "CANECA PORCELANA", barcode: "7891234567895" };

/** A volta do admin: a aba do PDV fica visível de novo. */
function voltarAoPdv() {
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function itemNoCarrinho(availableStock: number) {
  usePdvStore.getState().addItem({
    productId: 7,
    productGroupId: 3,
    name: CANECA.name,
    barcode: CANECA.barcode,
    price: 25,
    quantity: availableStock || 1,
    discount: 0,
    surcharge: 0,
    surchargeReason: "",
    availableStock,
    imageUrl: null,
  });
}

describe("useStockCorrectionReturn — a volta do Corrigir estoque", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStockCorrectionStore.setState({ pending: {} });
    // O jsdom não garante a aba "visível"; a volta é justamente ela ficar.
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  afterEach(() => {
    usePdvStore.getState().cancelSale();
  });

  it("na volta, o saldo novo vai para o carrinho, a base local e a lista — e o produto sai da anotação", async () => {
    itemNoCarrinho(1);
    mocks.searchPdvProducts.mockResolvedValue([{ ...CANECA, price: 25, stock: 6, productGroupId: 3 }]);
    const onRefreshed = vi.fn();
    renderHook(() => useStockCorrectionReturn({ online: true, onRefreshed }));
    // Anotado DEPOIS de montar: quem relê é a volta, e não a abertura.
    useStockCorrectionStore.getState().watch(CANECA);

    voltarAoPdv();

    await waitFor(() => expect(onRefreshed).toHaveBeenCalled());
    expect(mocks.searchPdvProducts).toHaveBeenCalledWith("7891234567895", 20);
    expect(usePdvStore.getState().items[0].availableStock).toBe(6);
    expect(mocks.refreshLocalStock).toHaveBeenCalledWith([{ productId: 7, stock: 6 }]);
    expect(onRefreshed).toHaveBeenCalledWith([{ productId: 7, name: CANECA.name, stock: 6 }]);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Estoque atualizado" }));
    expect(useStockCorrectionStore.getState().pending).toEqual({});
  });

  it("ainda zerado na volta: continua anotado para a próxima, sem aviso", async () => {
    // A pessoa voltou ao caixa antes de registrar a contagem no admin.
    mocks.searchPdvProducts.mockResolvedValue([{ ...CANECA, price: 25, stock: 0, productGroupId: 3 }]);
    const onRefreshed = vi.fn();
    renderHook(() => useStockCorrectionReturn({ online: true, onRefreshed }));
    useStockCorrectionStore.getState().watch(CANECA);

    voltarAoPdv();

    await waitFor(() => expect(onRefreshed).toHaveBeenCalled());
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(Object.keys(useStockCorrectionStore.getState().pending)).toEqual(["7"]);
  });

  it("sem anotação, a volta não vai ao servidor", () => {
    renderHook(() => useStockCorrectionReturn({ online: true }));

    voltarAoPdv();

    expect(mocks.searchPdvProducts).not.toHaveBeenCalled();
  });

  it("ao abrir o PDV relê o que ficou anotado, sem precisar de uma volta", async () => {
    // O celular pode encerrar o app instalado durante a correção: a anotação
    // ficou no aparelho, mas a reabertura não é uma "volta" (revisão da fase 3).
    useStockCorrectionStore.getState().watch(CANECA);
    mocks.searchPdvProducts.mockResolvedValue([{ ...CANECA, price: 25, stock: 4, productGroupId: 3 }]);
    const onRefreshed = vi.fn();

    renderHook(() => useStockCorrectionReturn({ online: true, onRefreshed }));

    await waitFor(() =>
      expect(onRefreshed).toHaveBeenCalledWith([{ productId: 7, name: CANECA.name, stock: 4 }]),
    );
  });

  it("relê quando a internet volta", async () => {
    useStockCorrectionStore.getState().watch(CANECA);
    mocks.searchPdvProducts.mockResolvedValue([{ ...CANECA, price: 25, stock: 2, productGroupId: 3 }]);
    const onRefreshed = vi.fn();
    const { rerender } = renderHook(
      ({ online }: { online: boolean }) => useStockCorrectionReturn({ online, onRefreshed }),
      { initialProps: { online: false } },
    );
    expect(mocks.searchPdvProducts).not.toHaveBeenCalled();

    rerender({ online: true });

    await waitFor(() => expect(onRefreshed).toHaveBeenCalled());
  });

  it("offline, não relê: fica para a próxima volta", () => {
    useStockCorrectionStore.getState().watch(CANECA);
    renderHook(() => useStockCorrectionReturn({ online: false }));

    voltarAoPdv();

    expect(mocks.searchPdvProducts).not.toHaveBeenCalled();
    expect(Object.keys(useStockCorrectionStore.getState().pending)).toEqual(["7"]);
  });
});

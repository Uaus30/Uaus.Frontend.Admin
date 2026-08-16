import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const registerWriteOff = vi.fn();
const refreshCounts = vi.fn();
const searchProducts = vi.fn();
const toast = vi.fn();
let offlineState = { online: true, hasLocalDatabase: true };

vi.mock("@/services/stock-write-off.service", () => ({
  registerWriteOff: (...args: unknown[]) => registerWriteOff(...args),
}));

// `LocalStockError` continua a classe real: é o `instanceof` que separa a recusa
// da base local de um erro de rede qualquer.
vi.mock("@/services/sales.service", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/sales.service")>()),
}));

vi.mock("@/hooks/use-offline-pdv", () => ({
  useOfflinePdv: () => ({ ...offlineState, refreshCounts }),
}));

vi.mock("@/lib/product-search", () => ({
  searchProducts: (...args: unknown[]) => searchProducts(...args),
}));

vi.mock("@workspace/ui", () => ({
  useToast: () => ({ toast }),
}));

const { useStockWriteOffDraft } = await import("../use-stock-write-off-draft");
const { LocalStockError } = await import("@/services/sales.service");

/** Produto com três unidades em estoque. */
const COPO = { id: 4, name: "Copo de vidro", barcode: "7890000000004", price: 9, stock: 3 };

const onOpenChange = vi.fn();
const onRegistered = vi.fn();

function render() {
  return renderHook(() => useStockWriteOffDraft({ open: true, onOpenChange, onRegistered }));
}

describe("useStockWriteOffDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    offlineState = { online: true, hasLocalDatabase: true };
    registerWriteOff.mockResolvedValue({ id: 1, totalQuantity: 1, offline: false });
    refreshCounts.mockResolvedValue(undefined);
    searchProducts.mockResolvedValue([]);
  });

  it("deve somar unidades ao escolher o mesmo produto de novo", async () => {
    const { result } = render();

    await act(async () => {
      result.current.pickProduct(COPO);
    });
    await act(async () => {
      result.current.pickProduct(COPO);
    });

    // O backend recusa a baixa com o mesmo produto em dois itens.
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(2);
  });

  it("deve acusar quantidade acima do saldo conhecido", async () => {
    const { result } = render();

    await act(async () => {
      result.current.pickProduct(COPO);
    });
    await act(async () => {
      result.current.changeQuantity(COPO.id, 5);
    });

    expect(result.current.shortages).toHaveLength(1);

    await act(() => result.current.confirm());

    expect(registerWriteOff).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Quantidade acima do estoque" }));
  });

  it("deve recusar a confirmação com a lista vazia", async () => {
    const { result } = render();

    await act(() => result.current.confirm());

    expect(registerWriteOff).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Nenhum produto na lista" }));
  });

  it("deve recusar a baixa offline sem base local", async () => {
    offlineState = { online: false, hasLocalDatabase: false };

    const { result } = render();
    await act(async () => {
      result.current.pickProduct(COPO);
    });
    await act(() => result.current.confirm());

    expect(registerWriteOff).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Base local indisponível" }));
  });

  it("deve gravar a baixa, avisar quem chamou e fechar o diálogo", async () => {
    const { result } = render();

    await act(async () => {
      result.current.pickProduct(COPO);
    });
    await act(async () => {
      result.current.setNotes("caiu da prateleira");
    });
    await act(() => result.current.confirm());

    const [payload, options] = registerWriteOff.mock.calls[0];
    expect(payload.items).toEqual([{ productId: 4, quantity: 1, productName: "Copo de vidro" }]);
    expect(payload.notes).toBe("caiu da prateleira");
    expect(options.offline).toBe(false);
    expect(refreshCounts).toHaveBeenCalled();
    expect(onRegistered).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("não deve recarregar do servidor uma baixa que ficou na fila", async () => {
    offlineState = { online: false, hasLocalDatabase: true };
    registerWriteOff.mockResolvedValue({ id: null, totalQuantity: 1, offline: true });

    const { result } = render();
    await act(async () => {
      result.current.pickProduct(COPO);
    });
    await act(() => result.current.confirm());

    expect(registerWriteOff).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ offline: true }),
    );
    expect(onRegistered).not.toHaveBeenCalled();
    expect(refreshCounts).toHaveBeenCalled();
  });

  it("deve reutilizar a chave de idempotência entre tentativas do mesmo rascunho", async () => {
    registerWriteOff.mockRejectedValueOnce(new Error("504"));

    const { result } = render();
    await act(async () => {
      result.current.pickProduct(COPO);
    });
    await act(() => result.current.confirm());
    await act(() => result.current.confirm());

    const first = registerWriteOff.mock.calls[0][1].clientReference;
    const second = registerWriteOff.mock.calls[1][1].clientReference;
    // Chave nova a cada clique baixaria o estoque duas vezes no servidor.
    expect(second).toBe(first);
  });

  it("deve explicar as faltas quando a base local recusa a baixa", async () => {
    registerWriteOff.mockRejectedValue(
      new LocalStockError([{ productId: 4, productName: "Copo de vidro", requested: 1, available: 0 }]),
    );

    const { result } = render();
    await act(async () => {
      result.current.pickProduct(COPO);
    });
    await act(() => result.current.confirm());

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Estoque insuficiente na base local",
        description: expect.stringContaining("Copo de vidro"),
      }),
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("deve descartar o rascunho ao fechar o diálogo", async () => {
    const { result } = render();

    await act(async () => {
      result.current.pickProduct(COPO);
      result.current.setNotes("algo");
    });
    await act(async () => {
      result.current.handleOpenChange(false);
    });

    // Reabrir com a lista da vez anterior faria o operador baixar duas vezes.
    expect(result.current.items).toEqual([]);
    expect(result.current.notes).toBe("");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PurchaseReceiptCancellationDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetPurchaseReceiptCancellation: vi.fn(),
  cancelPurchaseReceipt: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPurchaseReceiptCancellation: mocks.useGetPurchaseReceiptCancellation,
  cancelPurchaseReceipt: mocks.cancelPurchaseReceipt,
}));

const { useCancelPurchaseReceipt } = await import("../useCancelPurchaseReceipt");
const { getGetPurchasesQueryKey, getGetPurchaseEntriesQueryKey } =
  await import("@workspace/api-client-react");
const { RESOURCE_KEYS } = await import("@/hooks/use-catalog");

/** A prévia que o servidor devolve; o produto gerado só quando o teste pede. */
function previa(extras: Partial<PurchaseReceiptCancellationDto> = {}): PurchaseReceiptCancellationDto {
  return {
    purchaseId: 286,
    purchaseEntryId: 1323,
    canCancel: true,
    items: [{ productId: 1250, productName: "SACOLA [VERMELHA]", barcode: "7908573487583", quantity: 4 }],
    otherPurchaseIds: [],
    ...extras,
  };
}

const GERADO = {
  productGroupId: 1102,
  name: "SACOLA DE PAPEL PARA PRESENTE PEQUENA",
  barcodes: ["7908573487583"],
  canDelete: true,
};

function setup(preview: PurchaseReceiptCancellationDto | undefined) {
  mocks.useGetPurchaseReceiptCancellation.mockImplementation((id: number | null) => ({
    data: id == null ? undefined : preview,
    isLoading: false,
    isError: false,
    error: null,
  }));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const onCancelled = vi.fn();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useCancelPurchaseReceipt({ onCancelled }), { wrapper });
  return { ...hook, invalidate, onCancelled };
}

describe("useCancelPurchaseReceipt", () => {
  beforeEach(() => {
    mocks.cancelPurchaseReceipt.mockReset();
    mocks.toast.mockReset();
    mocks.cancelPurchaseReceipt.mockResolvedValue({ id: 286, status: "InTransit", productName: "SACOLA" });
  });

  it("a prévia só é pedida com a confirmação aberta, para a compra escolhida", () => {
    const { result } = setup(previa());
    expect(mocks.useGetPurchaseReceiptCancellation).toHaveBeenLastCalledWith(null);

    act(() => result.current.start({ id: 286, productName: "SACOLA" }));

    expect(mocks.useGetPurchaseReceiptCancellation).toHaveBeenLastCalledWith(286);
    expect(result.current.target).toEqual({ id: 286, productName: "SACOLA" });
  });

  it("produto criado no recebimento sai junto por padrão, e a compra reaberta vai para a edição", async () => {
    const { result, invalidate, onCancelled } = setup(previa({ generatedProduct: GERADO }));
    act(() => result.current.start({ id: 286, productName: "SACOLA" }));
    expect(result.current.deleteGeneratedProduct).toBe(true);

    act(() => result.current.confirm());

    await waitFor(() => expect(onCancelled).toHaveBeenCalledWith(expect.objectContaining({ id: 286 })));
    expect(mocks.cancelPurchaseReceipt).toHaveBeenCalledWith(286, { deleteGeneratedProduct: true });
    expect(result.current.target).toBeNull();
    // A compra, o produto e a aba Estoque dele: o saldo e a nota acabaram de mudar.
    const chaves = invalidate.mock.calls.map(([filtro]) => filtro?.queryKey);
    expect(chaves).toEqual(
      expect.arrayContaining([
        getGetPurchasesQueryKey(),
        RESOURCE_KEYS.products,
        getGetPurchaseEntriesQueryKey(),
      ]),
    );
  });

  it("desmarcar a caixa mantém o cadastro: só o estoque sai", async () => {
    const { result, onCancelled } = setup(previa({ generatedProduct: GERADO }));
    act(() => result.current.start({ id: 286, productName: "SACOLA" }));

    act(() => result.current.setDeleteGeneratedProduct(false));
    act(() => result.current.confirm());

    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
    expect(mocks.cancelPurchaseReceipt).toHaveBeenCalledWith(286, { deleteGeneratedProduct: false });
  });

  it("produto gerado que não pode sair nunca é pedido para excluir", async () => {
    const { result, onCancelled } = setup(
      previa({ generatedProduct: { ...GERADO, canDelete: false, blockedReason: "está na compra #290" } }),
    );
    act(() => result.current.start({ id: 286, productName: "SACOLA" }));
    expect(result.current.deleteGeneratedProduct).toBe(false);

    act(() => result.current.confirm());

    await waitFor(() => expect(onCancelled).toHaveBeenCalled());
    expect(mocks.cancelPurchaseReceipt).toHaveBeenCalledWith(286, { deleteGeneratedProduct: false });
  });

  it("com a prévia dizendo que não dá — ou ainda carregando —, confirmar não chama o servidor", () => {
    const bloqueada = setup(previa({ canCancel: false, blockedReason: "Parte já saiu do estoque." }));
    act(() => bloqueada.result.current.start({ id: 286, productName: "SACOLA" }));
    act(() => bloqueada.result.current.confirm());

    const carregando = setup(undefined);
    act(() => carregando.result.current.start({ id: 286, productName: "SACOLA" }));
    act(() => carregando.result.current.confirm());

    expect(mocks.cancelPurchaseReceipt).not.toHaveBeenCalled();
  });

  it("recusa do servidor mantém a confirmação aberta e mostra o motivo", async () => {
    mocks.cancelPurchaseReceipt.mockRejectedValue(new Error("Há uma conferência de estoque em andamento."));
    const { result, onCancelled } = setup(previa());
    act(() => result.current.start({ id: 286, productName: "SACOLA" }));

    act(() => result.current.confirm());

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Erro ao cancelar o recebimento", variant: "destructive" }),
      ),
    );
    expect(result.current.target).not.toBeNull();
    expect(onCancelled).not.toHaveBeenCalled();
  });
});

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  registerStockCount: vi.fn(),
  toast: vi.fn(),
  getProduct: vi.fn(),
}));

// Dubla só o que fala com a rede; as chaves de cache continuam as de verdade.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  registerStockCount: mocks.registerStockCount,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { useStockCount } = await import("../useStockCount");
const { dismissReactivatedProducts, subscribeToReactivations } = await import("@/lib/product-reactivation");

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** O resultado de uma contagem, como a API o devolve. */
function resultado(extras: Record<string, unknown> = {}) {
  return {
    productId: 20,
    productName: "ADAPTADOR T",
    previousStock: 10,
    countedStock: 11,
    difference: 1,
    purchaseEntryId: 901,
    ...extras,
  };
}

describe("useStockCount — o saldo que a modal mostrou", () => {
  beforeEach(() => vi.clearAllMocks());

  it("vai junto com a contagem, e a recusa relê o produto para a modal mostrar o saldo novo", async () => {
    // O servidor recusa quando o saldo mudou (outra contagem do mesmo SKU, ou o
    // reenvio desta); relido, a prévia da diferença se refaz antes de registrar.
    mocks.registerStockCount.mockRejectedValue(new Error("O estoque do sistema mudou de 10 para 7"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useStockCount(20, 10), { wrapper });

    act(() => result.current.updateForm({ counted: "7", notes: "quebrou" }));
    act(() => result.current.submit());

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    expect(mocks.registerStockCount).toHaveBeenCalledWith(20, expect.objectContaining({ expectedStock: 10 }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["product-for-entry", 20] });
  });
});

describe("useStockCount — a sobra que reativa o produto", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dismissReactivatedProducts();
  });

  it("anuncia a reativação: a sobra é uma entrada, e entrada devolve o produto a Ativo", async () => {
    const reativados = [{ productId: 20, productName: "ADAPTADOR T", previousStatus: "OutOfStock" }];
    mocks.registerStockCount.mockResolvedValue(resultado({ reactivatedProducts: reativados }));
    const ouvinte = vi.fn();
    const cancelar = subscribeToReactivations(ouvinte);
    const { result } = renderHook(() => useStockCount(20, 10), { wrapper: createWrapper() });

    act(() => result.current.updateForm({ counted: "11", notes: "caixa no depósito" }));
    act(() => result.current.submit());

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    cancelar();
    expect(ouvinte).toHaveBeenCalledWith(reativados);
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Sobra lançada como entrada" }),
    );
  });

  it("o reenvio que volta com diferença zero e sem a lista ainda avisa a reativação", async () => {
    // A primeira contagem gravou a sobra e reativou, mas a resposta se perdeu; a
    // segunda encontra o saldo igual ao contado e não traz a lista. A aba Estoque
    // mantém o produto em cache (`product-for-entry`), e é a comparação dele antes
    // e depois que revela a volta a Ativo.
    mocks.getProduct
      .mockResolvedValueOnce({
        id: 20,
        name: "ADAPTADOR T",
        displayName: "ADAPTADOR T",
        status: "OutOfStock",
      })
      .mockResolvedValue({ id: 20, name: "ADAPTADOR T", displayName: "ADAPTADOR T", status: "Active" });
    mocks.registerStockCount.mockResolvedValue(
      resultado({ previousStock: 11, countedStock: 11, difference: 0, purchaseEntryId: undefined }),
    );
    const ouvinte = vi.fn();
    const cancelar = subscribeToReactivations(ouvinte);
    const { result } = renderHook(
      () => {
        const produto = useQuery({ queryKey: ["product-for-entry", 20], queryFn: mocks.getProduct });
        return { produto, contagem: useStockCount(20, 11) };
      },
      { wrapper: createWrapper() },
    );
    await waitFor(() => expect(result.current.produto.data).toBeTruthy());

    act(() => result.current.contagem.updateForm({ counted: "11" }));
    act(() => result.current.contagem.submit());

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    cancelar();
    expect(ouvinte).toHaveBeenCalledWith([
      { productId: 20, productName: "ADAPTADOR T", previousStatus: "OutOfStock" },
    ]);
  });

  it("contagem que não reativou ninguém não anuncia nada — a API omite o campo", async () => {
    mocks.registerStockCount.mockResolvedValue(resultado());
    const ouvinte = vi.fn();
    const cancelar = subscribeToReactivations(ouvinte);
    const { result } = renderHook(() => useStockCount(20, 10), { wrapper: createWrapper() });

    act(() => result.current.updateForm({ counted: "11", notes: "caixa no depósito" }));
    act(() => result.current.submit());

    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
    cancelar();
    expect(ouvinte).not.toHaveBeenCalled();
  });
});

describe("useStockCount — a justificativa (14/10/2026)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("com sobra ou falta, não registra sem justificativa — e espaço em branco não conta", () => {
    const { result } = renderHook(() => useStockCount(20, 10), { wrapper: createWrapper() });

    act(() => result.current.updateForm({ counted: "7", notes: "   " }));

    expect(result.current.notesRequired).toBe(true);
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.submit());
    expect(mocks.registerStockCount).not.toHaveBeenCalled();
  });

  it("manda a justificativa digitada, sem os espaços das pontas", async () => {
    mocks.registerStockCount.mockResolvedValue(resultado({ countedStock: 7, difference: -3 }));
    const { result } = renderHook(() => useStockCount(20, 10), { wrapper: createWrapper() });

    act(() => result.current.updateForm({ counted: "7", notes: "  quebrou na prateleira " }));
    expect(result.current.canSubmit).toBe(true);
    act(() => result.current.submit());

    await waitFor(() => expect(mocks.registerStockCount).toHaveBeenCalled());
    expect(mocks.registerStockCount).toHaveBeenCalledWith(
      20,
      expect.objectContaining({ countedQuantity: 7, notes: "quebrou na prateleira" }),
    );
  });

  it("contagem igual ao sistema não pede justificativa: nada vai ser gravado", () => {
    const { result } = renderHook(() => useStockCount(20, 10), { wrapper: createWrapper() });

    act(() => result.current.updateForm({ counted: "10" }));

    expect(result.current.notesRequired).toBe(false);
    expect(result.current.canSubmit).toBe(true);
  });
});

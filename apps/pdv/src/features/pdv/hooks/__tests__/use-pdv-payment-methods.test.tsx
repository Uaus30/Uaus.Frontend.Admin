import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useGetPaymentMethods = vi.fn();
const listLocalPaymentMethods = vi.fn();

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPaymentMethods: (...args: unknown[]) => useGetPaymentMethods(...args),
}));

vi.mock("@/offline", () => ({
  listLocalPaymentMethods: () => listLocalPaymentMethods(),
}));

const { usePdvPaymentMethods } = await import("../use-pdv-payment-methods");

/** Forma vinda da API, com taxa de 3% em 2x. */
const CARTAO_API = {
  id: 2,
  createdAt: "2026-01-01",
  updatedAt: null,
  name: "Cartão",
  isActive: true,
  installments: [{ id: 21, paymentMethodId: 2, installmentNumber: 2, feePercentage: 3, isActive: true }],
};

/** Forma vinda do snapshot local, no formato reduzido da base. */
const PIX_LOCAL = {
  id: 5,
  name: "Pix",
  installments: [{ id: 51, installmentNumber: 1, feePercentage: 1.5 }],
};

describe("usePdvPaymentMethods", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listLocalPaymentMethods.mockResolvedValue([]);
    useGetPaymentMethods.mockReturnValue({ data: { data: [CARTAO_API] } });
  });

  it("deve usar as formas da API e desligar a consulta sem conexão", async () => {
    const { result } = renderHook(() => usePdvPaymentMethods(true, true));

    expect(result.current.paymentMethods).toEqual([CARTAO_API]);
    expect(useGetPaymentMethods).toHaveBeenCalledWith(
      { isActive: true, size: 100 },
      { query: { enabled: true } },
    );
    await waitFor(() => expect(listLocalPaymentMethods).toHaveBeenCalled());
  });

  it("deve ignorar formas desativadas que a API devolver", async () => {
    useGetPaymentMethods.mockReturnValue({
      data: { data: [{ ...CARTAO_API, id: 9, isActive: false }] },
    });

    const { result } = renderHook(() => usePdvPaymentMethods(true, true));

    // Nenhuma ativa na resposta: a lista fica vazia até a base local responder.
    expect(result.current.paymentMethods).toEqual([]);
    await waitFor(() => expect(listLocalPaymentMethods).toHaveBeenCalled());
  });

  it("deve cair para a base local quando a API não devolve forma ativa", async () => {
    useGetPaymentMethods.mockReturnValue({ data: undefined });
    listLocalPaymentMethods.mockResolvedValue([PIX_LOCAL]);

    const { result } = renderHook(() => usePdvPaymentMethods(false, true));

    await waitFor(() => expect(result.current.paymentMethods).toHaveLength(1));

    const [pix] = result.current.paymentMethods;
    expect(pix.name).toBe("Pix");
    // A taxa da parcela é o que o checkout precisa: sem ela a venda offline
    // subiria com taxa zerada.
    expect(pix.installments[0].feePercentage).toBe(1.5);
    expect(pix.installments[0].paymentMethodId).toBe(5);
    expect(pix.isActive).toBe(true);
  });

  it("deve carregar a base local mesmo estando online", async () => {
    listLocalPaymentMethods.mockResolvedValue([PIX_LOCAL]);

    renderHook(() => usePdvPaymentMethods(true, true));

    // A queda pode acontecer com o checkout já aberto; buscar na hora deixaria o
    // operador sem forma de pagamento na tela.
    await waitFor(() => expect(listLocalPaymentMethods).toHaveBeenCalled());
  });

  it("deve montar o nome de cada forma por ID", async () => {
    const { result } = renderHook(() => usePdvPaymentMethods(true, true));

    expect(result.current.paymentMethodNameById).toEqual({ 2: "Cartão" });
    await waitFor(() => expect(listLocalPaymentMethods).toHaveBeenCalled());
  });

  it("não deve derrubar a tela quando a base local não responde", async () => {
    useGetPaymentMethods.mockReturnValue({ data: undefined });
    listLocalPaymentMethods.mockRejectedValue(new Error("IndexedDB bloqueado"));

    const { result } = renderHook(() => usePdvPaymentMethods(false, false));

    await waitFor(() => expect(listLocalPaymentMethods).toHaveBeenCalled());
    expect(result.current.paymentMethods).toEqual([]);
  });
});

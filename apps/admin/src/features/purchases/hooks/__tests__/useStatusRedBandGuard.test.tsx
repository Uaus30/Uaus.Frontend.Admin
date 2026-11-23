import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PURCHASE_STATUS, type PurchaseBudgetDto, type PurchaseDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  getPurchaseBudget: vi.fn(),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  getPurchaseBudget: mocks.getPurchaseBudget,
}));

const { useStatusRedBandGuard } = await import("../useStatusRedBandGuard");

/**
 * Novembro amarelo: K = R$ 2.782 contra a linha verde de R$ 2.500 e a vermelha
 * de R$ 3.000 — sobram R$ 218 até o vermelho.
 */
function budget(overrides: Partial<PurchaseBudgetDto> = {}): PurchaseBudgetDto {
  return {
    month: "2026-11",
    periodStart: "2026-11-01T00:00:00",
    periodEnd: "2026-11-30T00:00:00",
    isCurrentMonth: true,
    isClosedMonth: false,
    isProvisional: false,
    openingBalance: 0,
    contributions: 0,
    availableBalance: 0,
    revenue: 3865,
    costOfSales: 2500,
    purchasesPaid: 2782,
    purchasesPlanned: 0,
    plannedWithoutValueCount: 0,
    fixedCosts: 865,
    greenLimit: 2500,
    redLimit: 3000,
    greenRoom: -282,
    redRoom: 218,
    band: "Yellow",
    bandIfPlannedBought: "Yellow",
    reliesOnBalance: false,
    stockValueAtCost: 34000,
    stockDays: 190,
    ...overrides,
  };
}

/** Só o que o guarda lê da linha: id, data, bruto, final e situação. */
function purchase(id: number, finalTotal: number, purchaseDate = "2026-11-20T00:00:00"): PurchaseDto {
  return {
    id,
    purchaseDate,
    grossTotal: finalTotal,
    finalTotal,
    status: PURCHASE_STATUS.Pending,
  } as PurchaseDto;
}

describe("useStatusRedBandGuard — 'Marcar como a caminho' pelo menu da linha", () => {
  beforeEach(() => {
    mocks.getPurchaseBudget.mockReset();
  });

  it("pergunta antes de gravar quando a compra leva o mês ao vermelho", async () => {
    mocks.getPurchaseBudget.mockResolvedValue(budget());
    const apply = vi.fn();
    const { result } = renderHook(() => useStatusRedBandGuard([purchase(7, 2183)], apply));

    await act(() => result.current.request(7, PURCHASE_STATUS.InTransit));

    // Sem o guarda, o menu gravava direto: o mês ia ao vermelho sem pergunta.
    expect(apply).not.toHaveBeenCalled();
    expect(mocks.getPurchaseBudget).toHaveBeenCalledWith({ month: "2026-11" });
    expect(result.current.pending).toEqual({ id: 7, status: PURCHASE_STATUS.InTransit, monthKey: "2026-11" });

    act(() => result.current.confirm());
    expect(apply).toHaveBeenCalledWith(7, PURCHASE_STATUS.InTransit);
    expect(result.current.pending).toBeNull();
  });

  it("'Deixar pendente' não grava nada", async () => {
    mocks.getPurchaseBudget.mockResolvedValue(budget());
    const apply = vi.fn();
    const { result } = renderHook(() => useStatusRedBandGuard([purchase(7, 2183)], apply));

    await act(() => result.current.request(7, PURCHASE_STATUS.InTransit));
    act(() => result.current.cancel());

    expect(apply).not.toHaveBeenCalled();
    expect(result.current.pending).toBeNull();
  });

  it("o clique que cai no diálogo depois de respondido não grava de novo", async () => {
    mocks.getPurchaseBudget.mockResolvedValue(budget());
    const apply = vi.fn();
    const { result } = renderHook(() => useStatusRedBandGuard([purchase(7, 2183)], apply));

    await act(() => result.current.request(7, PURCHASE_STATUS.InTransit));
    act(() => result.current.confirm());
    act(() => result.current.confirm());

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("grava direto quando a compra cabe antes do vermelho", async () => {
    mocks.getPurchaseBudget.mockResolvedValue(budget());
    const apply = vi.fn();
    const { result } = renderHook(() => useStatusRedBandGuard([purchase(7, 200)], apply));

    await act(() => result.current.request(7, PURCHASE_STATUS.InTransit));

    expect(apply).toHaveBeenCalledWith(7, PURCHASE_STATUS.InTransit);
    expect(result.current.pending).toBeNull();
  });

  it("mês já fechado não pergunta: a compra não muda o fechamento", async () => {
    mocks.getPurchaseBudget.mockResolvedValue(budget({ month: "2026-10", isClosedMonth: true }));
    const apply = vi.fn();
    const { result } = renderHook(() =>
      useStatusRedBandGuard([purchase(7, 2183, "2026-10-20T00:00:00")], apply),
    );

    await act(() => result.current.request(7, PURCHASE_STATUS.InTransit));

    expect(apply).toHaveBeenCalledWith(7, PURCHASE_STATUS.InTransit);
  });

  it("faixa que falha não trava a gravação", async () => {
    mocks.getPurchaseBudget.mockRejectedValue(new Error("rede"));
    const apply = vi.fn();
    const { result } = renderHook(() => useStatusRedBandGuard([purchase(7, 2183)], apply));

    await act(() => result.current.request(7, PURCHASE_STATUS.InTransit));

    expect(apply).toHaveBeenCalledWith(7, PURCHASE_STATUS.InTransit);
  });

  it("voltar para Pendente não mexe no dinheiro do mês e nem consulta a faixa", async () => {
    const apply = vi.fn();
    const { result } = renderHook(() => useStatusRedBandGuard([purchase(7, 2183)], apply));

    await act(() => result.current.request(7, PURCHASE_STATUS.Pending));

    expect(apply).toHaveBeenCalledWith(7, PURCHASE_STATUS.Pending);
    expect(mocks.getPurchaseBudget).not.toHaveBeenCalled();
  });
});

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PromotionRule } from "@workspace/core";

const mocks = vi.hoisted(() => ({ useGetCurrentPromotions: vi.fn() }));

// Só a consulta é dublada; enums e helpers vêm do módulo real.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCurrentPromotions: mocks.useGetCurrentPromotions,
}));

const { msUntilNextBoundary, useShelfPrice } = await import("../use-shelf-price");

/** Relâmpago das 08:00 às 18:00 de 11/10/2026 no grupo 7, preço final R$ 9,90. */
const RELAMPAGO = {
  data: [
    {
      id: 1,
      productGroupId: 7,
      productGroupIds: [7],
      type: "Flash",
      discountType: "FinalPrice",
      discountValue: 9.9,
      validFrom: "2026-10-11T08:00:00",
      validUntil: "2026-10-11T18:00:00",
    },
  ],
};

describe("useShelfPrice — o relógio do anúncio", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // A MESMA referência a cada render, como o React Query devolve para a mesma
    // resposta: é exatamente o caso em que a lista não muda às 18h.
    mocks.useGetCurrentPromotions.mockReturnValue(RELAMPAGO);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("a relâmpago some do anúncio no segundo seguinte ao fim, sem a lista mudar", () => {
    // Achado da revisão: a etiqueta montada às 17h e impressa às 18h30 saía com o
    // preço da relâmpago, porque nada reavaliava a vigência.
    vi.setSystemTime(new Date(2026, 9, 11, 17, 59, 30));
    const { result } = renderHook(() => useShelfPrice());

    expect(result.current.shelfPriceOf(7, 12.9)).toMatchObject({ kind: "unit", price: 9.9 });
    const antes = result.current.shelfPriceOf;

    act(() => {
      vi.advanceTimersByTime(31_000 + 100);
    });

    // A IDENTIDADE muda na virada: é ela que faz quem memoriza (as linhas da
    // listagem, os itens da etiqueta) recalcular. Antes, a função era a mesma, e
    // a listagem seguia com o preço da relâmpago.
    expect(result.current.shelfPriceOf).not.toBe(antes);
    expect(result.current.shelfPriceOf(7, 12.9)).toEqual({ kind: "regular", price: 12.9 });
  });

  it("a relâmpago entra no anúncio quando começa, com a tela aberta desde antes", () => {
    vi.setSystemTime(new Date(2026, 9, 11, 7, 59, 0));
    const { result } = renderHook(() => useShelfPrice());

    expect(result.current.shelfPriceOf(7, 12.9).kind).toBe("regular");

    act(() => {
      vi.advanceTimersByTime(60_000 + 100);
    });

    expect(result.current.shelfPriceOf(7, 12.9)).toMatchObject({ kind: "unit", price: 9.9 });
  });
});

describe("msUntilNextBoundary", () => {
  const rule = (validFrom: string, validUntil: string | null): PromotionRule => ({
    id: 1,
    kind: "flash",
    discountKind: "finalPrice",
    discountValue: 1,
    productGroupIds: [1],
    comboQuantity: null,
    validFrom,
    validUntil,
    maxQuantityPerSale: null,
  });

  it("o fim é inclusivo: a virada é um segundo depois dele", () => {
    const agora = new Date(2026, 9, 11, 17, 0, 0).getTime();
    expect(msUntilNextBoundary([rule("2026-10-11T08:00:00", "2026-10-11T18:00:00")], agora)).toBe(
      60 * 60 * 1000 + 1000,
    );
  });

  it("sem início nem fim pela frente, não há virada", () => {
    const agora = new Date(2026, 9, 11, 17, 0, 0).getTime();
    expect(msUntilNextBoundary([rule("2026-10-01T00:00:00", null)], agora)).toBeNull();
  });
});

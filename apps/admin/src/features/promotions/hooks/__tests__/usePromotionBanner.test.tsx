import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE, type PromotionDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetPromotions: vi.fn(),
  toast: vi.fn(),
  buildHtml: vi.fn(() => "<html>folha</html>"),
  openTab: vi.fn(() => true),
}));

// Só o que fala com a rede é dublado; o resto do api-client é o real.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPromotions: mocks.useGetPromotions,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

// A folha e a aba são de outro módulo, com teste próprio: aqui interessa O QUE
// o hook manda imprimir e o que ele faz quando a aba não abre.
vi.mock("../../banner-print", () => ({
  buildPromotionBannerSheetHtml: mocks.buildHtml,
  openPromotionBannerTab: mocks.openTab,
}));

const { usePromotionBanner, BANNER_CANDIDATES_LIMIT } = await import("../usePromotionBanner");

function promocao(parcial: Partial<PromotionDto> = {}): PromotionDto {
  return {
    id: 1,
    createdAt: "2026-10-16T08:00:00",
    productGroupId: 7,
    productGroupName: "COPO AMERICANO",
    type: PROMOTION_TYPE.Flash,
    discountType: PROMOTION_DISCOUNT_TYPE.FinalPrice,
    discountValue: 0.99,
    validFrom: "2026-10-17T08:00:00",
    validUntil: "2026-10-17T18:00:59",
    isActive: true,
    showOnSite: false,
    investment: 0,
    referencePriceMin: 1.75,
    referencePriceMax: 1.75,
    promotionalPriceMin: 0.99,
    promotionalPriceMax: 0.99,
    ...parcial,
  };
}

/**
 * Os três casos independem do relógio de propósito: Dia a Dia sem prazo começado
 * em 2000 (no ar), relâmpago em 2099 (programada) e uma acabada em 2001. A
 * virada de situação com a hora é provada em `promotionRules.test.ts`.
 */
const NO_AR = promocao({
  id: 1,
  type: PROMOTION_TYPE.Everyday,
  validFrom: "2000-01-01T00:00:00",
  validUntil: null,
});
const PROGRAMADA = promocao({ id: 2, validFrom: "2099-01-01T08:00:00", validUntil: "2099-01-01T18:00:59" });
const ENCERRADA = promocao({ id: 3, validFrom: "2001-01-01T08:00:00", validUntil: "2001-01-01T18:00:59" });

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.openTab.mockReturnValue(true);
  mocks.useGetPromotions.mockReturnValue({
    data: { data: [PROGRAMADA, ENCERRADA, NO_AR], page: 1, limit: 100, total: 3, totalPages: 1 },
    isLoading: false,
  });
});

describe("usePromotionBanner", () => {
  it("só consulta com a modal aberta, e lista as no ar antes das programadas, sem a encerrada", () => {
    const { result } = renderHook(() => usePromotionBanner(), { wrapper });

    expect(mocks.useGetPromotions).toHaveBeenLastCalledWith(
      { onlyActive: true, page: 1, limit: BANNER_CANDIDATES_LIMIT },
      { query: { enabled: false } },
    );

    act(() => result.current.abrir());

    expect(result.current.open).toBe(true);
    expect(mocks.useGetPromotions).toHaveBeenLastCalledWith(expect.anything(), { query: { enabled: true } });
    expect(result.current.candidates.map((row) => row.id)).toEqual([1, 2]);
  });

  it("imprime as marcadas com o nome reescrito e as cópias, e fecha a modal", () => {
    const { result } = renderHook(() => usePromotionBanner(), { wrapper });
    act(() => result.current.abrir());
    const noAr = result.current.candidates[0];

    act(() => result.current.toggle(noAr));
    act(() => result.current.setName(noAr, "  Copo  "));
    act(() => result.current.setCopies(noAr, 2));

    expect(result.current.editOf(noAr)).toEqual({ selected: true, name: "  Copo  ", copies: 2 });
    expect(result.current.bannerCount).toBe(2);

    act(() => result.current.imprimir());

    expect(mocks.buildHtml).toHaveBeenCalledWith(
      [{ productName: "Copo", lead: "", price: 0.99, copies: 2 }],
      "PROMOÇÃO",
    );
    expect(mocks.openTab).toHaveBeenCalledWith("<html>folha</html>");
    expect(result.current.open).toBe(false);
  });

  it("o título digitado vai para a folha; vazio volta para PROMOÇÃO", () => {
    const { result } = renderHook(() => usePromotionBanner(), { wrapper });
    act(() => result.current.abrir());
    act(() => result.current.toggle(result.current.candidates[0]));
    act(() => result.current.setTitle("  Só hoje  "));

    act(() => result.current.imprimir());

    expect(mocks.buildHtml).toHaveBeenLastCalledWith(expect.any(Array), "Só hoje");
  });

  it("sem nada marcado, Imprimir não abre aba", () => {
    const { result } = renderHook(() => usePromotionBanner(), { wrapper });
    act(() => result.current.abrir());

    act(() => result.current.imprimir());

    expect(mocks.openTab).not.toHaveBeenCalled();
    expect(result.current.open).toBe(true);
  });

  it("aba bloqueada pelo navegador: avisa e deixa a modal aberta", () => {
    mocks.openTab.mockReturnValue(false);
    const { result } = renderHook(() => usePromotionBanner(), { wrapper });
    act(() => result.current.abrir());
    act(() => result.current.toggle(result.current.candidates[0]));

    act(() => result.current.imprimir());

    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
    expect(result.current.open).toBe(true);
  });

  it("a seleção sobrevive ao fechar da modal, para reimprimir sem remontar", () => {
    const { result } = renderHook(() => usePromotionBanner(), { wrapper });
    act(() => result.current.abrir());
    const noAr = result.current.candidates[0];
    act(() => result.current.toggle(noAr));

    act(() => result.current.onOpenChange(false));
    act(() => result.current.abrir());

    expect(result.current.editOf(noAr).selected).toBe(true);
  });
});

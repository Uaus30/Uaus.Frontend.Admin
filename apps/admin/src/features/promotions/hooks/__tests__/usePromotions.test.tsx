import React from "react";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE, type PromotionDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetPromotions: vi.fn(),
  endPromotionNow: vi.fn(),
  deletePromotion: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado. As chaves de cache vêm do módulo REAL:
// redefini-las aqui já mascarou uma quebra de invalidação em outra feature,
// porque o teste passava contra a chave inventada no mock.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetPromotions: mocks.useGetPromotions,
  endPromotionNow: mocks.endPromotionNow,
  deletePromotion: mocks.deletePromotion,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { usePromotions } = await import("../usePromotions");

function promocao(parcial: Partial<PromotionDto> = {}): PromotionDto {
  return {
    id: 1,
    createdAt: "2026-09-19T08:00:00",
    productGroupId: 7,
    productGroupName: "COPO AMERICANO",
    type: PROMOTION_TYPE.Flash,
    discountType: PROMOTION_DISCOUNT_TYPE.FinalPrice,
    discountValue: 0.99,
    validFrom: "2026-09-19T14:00:00",
    validUntil: "2026-09-19T18:00:59",
    isActive: true,
    showOnSite: false,
    referencePriceMin: 1.75,
    referencePriceMax: 1.75,
    promotionalPriceMin: 0.99,
    promotionalPriceMax: 0.99,
    ...parcial,
  };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, "", "/marketing/promocoes");
  mocks.useGetPromotions.mockReturnValue({
    data: { data: [promocao()], page: 1, limit: 10, total: 1, totalPages: 1 },
    isLoading: false,
  });
});

describe("usePromotions", () => {
  it("carimba a situação de cada linha", () => {
    // A situação é calculada no hook, e não na linha da tabela: um `new Date()`
    // dentro do componente mudaria de resposta a cada render sem nada acusar.
    //
    // Os dois casos são independentes de relógio de propósito — inativa e um
    // início em 2099. O que depende de hora (no ar × encerrada, e a virada do
    // último segundo) é provado em `promotionRules.test.ts`, com o instante
    // passado por parâmetro, que é o único jeito de isso não falhar à noite.
    mocks.useGetPromotions.mockReturnValue({
      data: {
        data: [
          promocao({ id: 1, isActive: false }),
          promocao({ id: 2, validFrom: "2099-01-01T08:00:00", validUntil: "2099-01-01T18:00:59" }),
        ],
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      },
      isLoading: false,
    });

    const { result } = renderHook(() => usePromotions(), { wrapper });

    expect(result.current.promotions.map((row) => row.situation)).toEqual(["inativa", "programada"]);
  });

  it("trocar filtro volta para a página 1", () => {
    // Filtrar estando na página 3 devolveria uma lista vazia — e o bloco de
    // paginação some junto, sem nem um "Anterior" para voltar.
    const { result } = renderHook(() => usePromotions(), { wrapper });

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setSearchInput("copo"));
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(3));
    act(() => result.current.setOnlyActive(true));
    expect(result.current.page).toBe(1);
  });

  it("navega para o cadastro e volta DEVOLVENDO a entrada do histórico", async () => {
    const { result } = renderHook(() => usePromotions(), { wrapper });

    act(() => result.current.abrirNova());
    expect(result.current.screen).toEqual({ kind: "nova" });
    expect(window.location.pathname).toMatch(/promocoes\/nova$/);

    // `history.back()`, e não um terceiro `pushState`: empilhar mais uma entrada
    // faria o "voltar" do navegador reabrir o cadastro que acabou de fechar.
    act(() => result.current.voltarParaLista());

    await waitFor(() => expect(result.current.screen).toEqual({ kind: "lista" }));
    expect(window.location.pathname).toMatch(/promocoes$/);
  });

  it("abre o detalhe pelo id", () => {
    const { result } = renderHook(() => usePromotions(), { wrapper });

    act(() => result.current.abrirDetalhe(42));

    expect(result.current.screen).toEqual({ kind: "detalhe", id: 42 });
    expect(window.location.pathname).toMatch(/promocoes\/42$/);
  });

  it("nasce no detalhe quando a URL já aponta para uma promoção", () => {
    // É o link compartilhado — a razão de a tela não ser modal.
    window.history.pushState({}, "", "/marketing/promocoes/7");

    const { result } = renderHook(() => usePromotions(), { wrapper });

    expect(result.current.screen).toEqual({ kind: "detalhe", id: 7 });
  });

  it("encerra a promoção e avisa", async () => {
    mocks.endPromotionNow.mockResolvedValue(promocao());
    const { result } = renderHook(() => usePromotions(), { wrapper });

    await act(async () => {
      await result.current.encerrar(1);
    });

    expect(mocks.endPromotionNow).toHaveBeenCalledWith(1);
    await waitFor(() => expect(mocks.toast).toHaveBeenCalled());
  });

  it("mostra o erro do servidor quando a exclusão é recusada", async () => {
    mocks.deletePromotion.mockRejectedValue(new Error("recusado"));
    const { result } = renderHook(() => usePromotions(), { wrapper });

    await act(async () => {
      await result.current.excluir(1).catch(() => undefined);
    });

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });
});

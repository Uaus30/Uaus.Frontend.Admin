import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PdvPromotionDto } from "@workspace/api-client-react";
import type { LocalPromotion } from "@/offline";

const mocks = vi.hoisted(() => ({
  getPdvPromotions: vi.fn(),
  readLocalPromotions: vi.fn(),
  writeLocalPromotions: vi.fn(),
}));

// Só o que fala com a rede e com o IndexedDB é dublado. `toLocalPromotion` e os
// enums vêm do módulo REAL: é justamente a normalização do enum que este hook
// precisa fazer certo, e dublá-la faria o teste concordar com um mock.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  getPdvPromotions: mocks.getPdvPromotions,
}));

vi.mock("@/offline", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/offline")>()),
  readLocalPromotions: mocks.readLocalPromotions,
  writeLocalPromotions: mocks.writeLocalPromotions,
}));

const { usePromotions } = await import("../use-promotions");
const { usePdvStore } = await import("@/stores/use-pdv-store");
const { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE } = await import("@workspace/api-client-react");

/** Promoção como a API a serializa: os enums pelo nome. */
const DA_API: PdvPromotionDto = {
  id: 4,
  productGroupId: 10,
  type: "Flash",
  discountType: "FinalPrice",
  discountValue: 0.99,
  validFrom: "2026-09-19T08:00:00",
  validUntil: "2026-09-19T18:00:00",
  maxQuantityPerSale: 6,
};

/** Promoção já gravada na base local, de um turno anterior. */
const DA_BASE: LocalPromotion = {
  id: 9,
  productGroupId: 11,
  type: PROMOTION_TYPE.Everyday,
  discountType: PROMOTION_DISCOUNT_TYPE.Percentage,
  discountValue: 10,
  validFrom: "2026-09-01T00:00:00",
  validUntil: null,
  maxQuantityPerSale: null,
};

describe("usePromotions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePdvStore.setState({ promotions: [], status: "IDLE", items: [] });
    mocks.readLocalPromotions.mockResolvedValue([]);
    mocks.writeLocalPromotions.mockResolvedValue(undefined);
    mocks.getPdvPromotions.mockResolvedValue([]);
  });

  it("deve publicar no balcão as promoções da API, com os enums normalizados", async () => {
    mocks.getPdvPromotions.mockResolvedValue([DA_API]);

    renderHook(() => usePromotions(true));

    await waitFor(() => expect(usePdvStore.getState().promotions).toHaveLength(1));
    expect(usePdvStore.getState().promotions[0]).toMatchObject({
      id: 4,
      type: PROMOTION_TYPE.Flash,
      discountType: PROMOTION_DISCOUNT_TYPE.FinalPrice,
    });
  });

  it("deve gravar na base local o que veio da API", async () => {
    // É a gravação que sobrevive à queda de rede: sem ela, o caixa que perdesse a
    // internet no meio do sábado ficaria sem promoção nenhuma.
    mocks.getPdvPromotions.mockResolvedValue([DA_API]);

    renderHook(() => usePromotions(true));

    await waitFor(() => expect(mocks.writeLocalPromotions).toHaveBeenCalled());
    expect(mocks.writeLocalPromotions).toHaveBeenCalledWith([expect.objectContaining({ id: 4 })]);
  });

  it("deve valer a base local quando não há rede", async () => {
    mocks.readLocalPromotions.mockResolvedValue([DA_BASE]);

    renderHook(() => usePromotions(false));

    await waitFor(() => expect(usePdvStore.getState().promotions).toEqual([DA_BASE]));
    expect(mocks.getPdvPromotions).not.toHaveBeenCalled();
  });

  it("não deve deixar a base local sobrescrever a resposta da API que chegou antes", async () => {
    // A leitura do IndexedDB numa base grande pode terminar DEPOIS da resposta da
    // rede. Sem o guard, a lista mais velha entraria por cima da mais nova e a
    // relâmpago cadastrada hoje sumiria do balcão.
    let liberarBaseLocal!: (promocoes: LocalPromotion[]) => void;
    mocks.readLocalPromotions.mockReturnValue(
      new Promise<LocalPromotion[]>((resolve) => {
        liberarBaseLocal = resolve;
      }),
    );
    mocks.getPdvPromotions.mockResolvedValue([DA_API]);

    renderHook(() => usePromotions(true));

    await waitFor(() => expect(usePdvStore.getState().promotions).toHaveLength(1));
    liberarBaseLocal([DA_BASE]);

    await waitFor(() => expect(mocks.readLocalPromotions).toHaveBeenCalled());
    expect(usePdvStore.getState().promotions[0].id).toBe(4);
  });

  it("deve manter o que já valia quando a API falha", async () => {
    // Promoção é enfeite do preço, não pré-requisito da venda: a falha é
    // silenciosa de propósito, e o que está gravado continua valendo.
    mocks.readLocalPromotions.mockResolvedValue([DA_BASE]);
    mocks.getPdvPromotions.mockRejectedValue(new Error("sem rede"));

    renderHook(() => usePromotions(true));

    await waitFor(() => expect(usePdvStore.getState().promotions).toEqual([DA_BASE]));
    expect(mocks.writeLocalPromotions).not.toHaveBeenCalled();
  });

  it("não deve buscar de novo a cada venda da fila do sábado", async () => {
    const { rerender } = renderHook(() => usePromotions(true));

    await waitFor(() => expect(mocks.getPdvPromotions).toHaveBeenCalledTimes(1));

    usePdvStore.setState({ status: "SELLING" });
    rerender();

    // A busca da abertura da venda só acontece com a lista velha de mais de um
    // minuto: a janela da promoção não muda entre dois clientes da fila.
    expect(mocks.getPdvPromotions).toHaveBeenCalledTimes(1);
  });
});

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getStorefrontFlashPromotion } from "./storefront";

/**
 * O banner da relâmpago contra a resposta REAL do servidor.
 *
 * Sem promoção no ar o endpoint devolve **204**, e esse é o caso da maior parte
 * da semana — a loja faz uma relâmpago. Ler isso com `apiGetOrThrow` fazia toda
 * visita à home gastar quatro requisições (a original e as três tentativas do
 * React Query) e encher o console do site público de erro, por uma resposta que
 * é normal.
 */
describe("getStorefrontFlashPromotion", () => {
  const fetchOriginal = globalThis.fetch;

  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => {
    globalThis.fetch = fetchOriginal;
  });

  it("204 vira null, e não erro", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 })) as unknown as typeof fetch;

    await expect(getStorefrontFlashPromotion()).resolves.toBeNull();
  });

  it("com promoção no ar, devolve o banner", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          productGroupId: 7,
          name: "COPO AMERICANO",
          promotion: { type: "Flash", price: 0.99, referencePrice: 1.75, endsInSeconds: 7320 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    await expect(getStorefrontFlashPromotion()).resolves.toMatchObject({
      productGroupId: 7,
      promotion: { endsInSeconds: 7320 },
    });
  });
});

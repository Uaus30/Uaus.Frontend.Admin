import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROMOTION_DISCOUNT_TYPE, PROMOTION_TYPE } from "@workspace/api-client-react";
import type { PdvSnapshotPromotion } from "./types";

const readMeta = vi.fn();
const writeMeta = vi.fn();

vi.mock("./database", () => ({
  META_KEY: {
    snapshotSchemaVersion: "snapshotSchemaVersion",
    snapshotDownloadedAt: "snapshotDownloadedAt",
    snapshotGeneratedAt: "snapshotGeneratedAt",
    offlineSaleSequence: "offlineSaleSequence",
    cashRegisterSession: "cashRegisterSession",
    companySettings: "companySettings",
    coupons: "coupons",
    promotions: "promotions",
  },
}));

vi.mock("./meta", () => ({
  readMeta: (...args: unknown[]) => readMeta(...args),
  writeMeta: (...args: unknown[]) => writeMeta(...args),
}));

const { readLocalPromotions, toLocalPromotion, writeLocalPromotions } = await import("./promotions");

/** Promoção como o servidor a serializa: os dois enums pelo NOME. */
function snapshotPromotion(overrides: Partial<PdvSnapshotPromotion> = {}): PdvSnapshotPromotion {
  return {
    id: 1,
    productGroupId: 10,
    type: "Flash",
    discountType: "FinalPrice",
    discountValue: 0.99,
    validFrom: "2026-09-19T08:00:00",
    validUntil: "2026-09-19T18:00:00",
    maxQuantityPerSale: 6,
    ...overrides,
  };
}

describe("toLocalPromotion", () => {
  it("deve normalizar os enums que chegam pelo nome", () => {
    // A API serializa enum por nome, e o carrinho compara contra o CÓDIGO. Sem a
    // normalização na carga, toda avaliação daria falso e nenhuma promoção valeria
    // no balcão — sem erro nenhum na tela.
    const local = toLocalPromotion(snapshotPromotion());

    expect(local.type).toBe(PROMOTION_TYPE.Flash);
    expect(local.discountType).toBe(PROMOTION_DISCOUNT_TYPE.FinalPrice);
  });

  it("deve aceitar o enum que já vem como número", () => {
    const local = toLocalPromotion(
      snapshotPromotion({ type: PROMOTION_TYPE.Everyday, discountType: PROMOTION_DISCOUNT_TYPE.Percentage }),
    );

    expect(local.type).toBe(PROMOTION_TYPE.Everyday);
    expect(local.discountType).toBe(PROMOTION_DISCOUNT_TYPE.Percentage);
  });

  it("deve cair em None quando o enum é ilegível", () => {
    // `None` não casa com grupo nenhum no carrinho: a promoção estragada
    // simplesmente não vale, em vez de valer pela metade.
    const local = toLocalPromotion(snapshotPromotion({ type: "Inexistente", discountType: null }));

    expect(local.type).toBe(PROMOTION_TYPE.None);
    expect(local.discountType).toBe(PROMOTION_DISCOUNT_TYPE.None);
  });

  it("deve trocar o campo omitido por nulo, não por undefined", () => {
    // A API omite o nulo do JSON. O carrinho compara `validUntil == null`, e o
    // gravado no IndexedDB precisa sobreviver à serialização estruturada.
    const local = toLocalPromotion(
      snapshotPromotion({ validUntil: undefined, maxQuantityPerSale: undefined }),
    );

    expect(local.validUntil).toBeNull();
    expect(local.maxQuantityPerSale).toBeNull();
  });
});

describe("gravação e leitura", () => {
  beforeEach(() => {
    readMeta.mockReset();
    writeMeta.mockReset();
  });

  it("deve gravar a lista inteira na chave de promoções", async () => {
    await writeLocalPromotions([toLocalPromotion(snapshotPromotion())]);

    expect(writeMeta).toHaveBeenCalledWith("promotions", [expect.objectContaining({ id: 1 })]);
  });

  it("deve gravar lista vazia quando não há promoção nenhuma", async () => {
    // Substituição, nunca mesclagem: promoção que sumiu do servidor (encerrada,
    // excluída, fora da janela de sete dias) tem que sumir do balcão, senão ela
    // continuaria valendo até alguém fechar o caixa.
    await writeLocalPromotions(null);

    expect(writeMeta).toHaveBeenCalledWith("promotions", []);
  });

  it("deve devolver lista vazia quando o caixa nunca recebeu promoções", async () => {
    readMeta.mockResolvedValue(undefined);

    expect(await readLocalPromotions()).toEqual([]);
  });

  it("deve descartar o valor corrompido em vez de devolvê-lo", async () => {
    readMeta.mockResolvedValue({ nao: "é uma lista" });

    expect(await readLocalPromotions()).toEqual([]);
  });
});

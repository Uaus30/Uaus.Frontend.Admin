import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LocalCoupon, PdvSnapshotCoupon, PendingSale, PendingSaleCoupon } from "./types";

const readMeta = vi.fn();
const writeMeta = vi.fn();
const listPendingSales = vi.fn();

vi.mock("./database", () => ({
  META_KEY: {
    snapshotSchemaVersion: "snapshotSchemaVersion",
    snapshotDownloadedAt: "snapshotDownloadedAt",
    snapshotGeneratedAt: "snapshotGeneratedAt",
    offlineSaleSequence: "offlineSaleSequence",
    cashRegisterSession: "cashRegisterSession",
    companySettings: "companySettings",
    coupons: "coupons",
  },
}));

vi.mock("./meta", () => ({
  readMeta: (...args: unknown[]) => readMeta(...args),
  writeMeta: (...args: unknown[]) => writeMeta(...args),
}));

vi.mock("./pending-sales", () => ({
  listPendingSales: (...args: unknown[]) => listPendingSales(...args),
}));

const { countQueuedRedemptions, lookupLocalCoupon, resolveLocalCoupon, toLocalCoupon, writeLocalCoupons } =
  await import("./coupons");

/** Cupom da base local: 10% em setembro, sem teto de uso e sem questionário. */
function localCoupon(overrides: Partial<LocalCoupon> = {}): LocalCoupon {
  return {
    couponId: 12,
    code: "10OFFSET26",
    description: "Setembro 2026",
    discountType: 1,
    discountValue: 10,
    validFrom: "2026-09-01T00:00:00",
    validUntil: "2026-09-30T23:59:59",
    remainingAtSnapshot: null,
    questions: [],
    ...overrides,
  };
}

/** Venda da fila, opcionalmente com cupom. */
function pendingSale(
  reference: string,
  coupon: PendingSaleCoupon | null = null,
  overrides: Partial<PendingSale> = {},
): PendingSale {
  return {
    clientReference: reference,
    offlineNumber: 1,
    occurredAt: "2026-09-15T10:00:00",
    cashRegisterSessionId: 7,
    customerId: null,
    customerDocument: null,
    total: 90,
    discount: 10,
    coupon,
    notes: null,
    items: [{ productId: 1, quantity: 1, unitPrice: 100, productName: "Café" }],
    payments: [],
    status: "pending",
    attempts: 0,
    lastError: null,
    stockApplied: true,
    ...overrides,
  };
}

/** Bloco de cupom de uma venda da fila. */
function saleCoupon(couponId: number): PendingSaleCoupon {
  return {
    couponId,
    code: "10OFFSET26",
    discountType: 1,
    discountValue: 10,
    baseAmount: 100,
    discountAmount: 10,
    answers: [],
  };
}

/** Entrada da decisão, com a base local sadia e o relógio dentro do turno. */
function input(overrides: Partial<Parameters<typeof resolveLocalCoupon>[0]> = {}) {
  return {
    coupons: [localCoupon()],
    code: "10OFFSET26",
    now: new Date("2026-09-15T10:00:00"),
    generatedAt: "2026-09-15T08:00:00",
    queued: new Map<number, number>(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listPendingSales.mockResolvedValue([]);
});

describe("toLocalCoupon", () => {
  it("deve normalizar código e tipo de desconto na carga", () => {
    // O operador digita minúsculas e a API serializa o enum pelo NOME. Resolver
    // os dois na carga (uma vez por turno) e não na consulta (a cada tecla) é a
    // mesma escolha do `searchName` do produto.
    const snapshotCoupon: PdvSnapshotCoupon = {
      couponId: 12,
      code: " bemvindo ",
      discountType: "Amount",
      discountValue: 20,
      validFrom: "2026-09-01T00:00:00",
    };

    expect(toLocalCoupon(snapshotCoupon)).toMatchObject({
      code: "BEMVINDO",
      discountType: 2,
    });
  });

  it("deve tratar limite ausente como ILIMITADO, não como esgotado", () => {
    // O backend omite campo nulo do JSON (WhenWritingNull). Ler a ausência como
    // zero recusaria offline todo cupom sem teto — que é a maioria deles.
    const coupon = toLocalCoupon({
      couponId: 12,
      code: "X",
      discountType: 1,
      discountValue: 10,
      validFrom: "2026-09-01T00:00:00",
    });

    expect(coupon.remainingAtSnapshot).toBeNull();
    expect(coupon.validUntil).toBeNull();
    expect(coupon.questions).toEqual([]);
  });

  it("deve preservar o questionário já resolvido", () => {
    // É o que permite encontrar a campanha pelo CÓDIGO DO CUPOM sem rede. Repare
    // que não há `campaignId` em lugar nenhum: o PDV nunca sabe de onde as
    // perguntas vieram.
    const coupon = toLocalCoupon({
      couponId: 12,
      code: "X",
      discountType: 1,
      discountValue: 10,
      validFrom: "2026-09-01T00:00:00",
      questions: [
        {
          questionId: 7,
          label: "Como conheceu a loja?",
          isRequired: true,
          options: [
            { optionId: 21, label: "Instagram" },
            { optionId: 22, label: "Indicação" },
          ],
        },
      ],
    });

    expect(coupon.questions[0].options).toHaveLength(2);
    expect(coupon).not.toHaveProperty("campaignId");
  });
});

describe("countQueuedRedemptions", () => {
  it("deve contar um resgate por venda pendente com cupom", () => {
    const queued = countQueuedRedemptions([
      pendingSale("ref-1", saleCoupon(12)),
      pendingSale("ref-2", saleCoupon(12)),
      pendingSale("ref-3", saleCoupon(99)),
      pendingSale("ref-4"),
    ]);

    expect(queued.get(12)).toBe(2);
    expect(queued.get(99)).toBe(1);
  });

  it("não deve contar venda recusada pelo servidor", () => {
    // A recusa significa que nenhum resgate foi gravado e nenhum uso consumido.
    // Contá-la subestimaria o saldo do cupom para os próximos clientes.
    const queued = countQueuedRedemptions([
      pendingSale("ref-1", saleCoupon(12), { status: "failed", stockApplied: false }),
    ]);

    expect(queued.size).toBe(0);
  });

  it("deve ignorar venda da fila anterior a esta feature", () => {
    // `pendingSales` sobrevive à migração: há vendas na fila sem o campo `coupon`.
    const legada = pendingSale("ref-1");
    delete (legada as { coupon?: unknown }).coupon;

    expect(countQueuedRedemptions([legada]).size).toBe(0);
  });
});

describe("resolveLocalCoupon", () => {
  it("deve encontrar o cupom pelo código, em qualquer caixa de letra", () => {
    const found = resolveLocalCoupon(input({ code: " 10offset26 " }));

    expect(found).toMatchObject({ outcome: "found", overLimit: false, remainingUses: null });
  });

  it("deve recusar código que não está na base local", () => {
    expect(resolveLocalCoupon(input({ code: "NAOEXISTE" }))).toEqual({
      outcome: "refused",
      reason: "not-found",
      message: "Cupom não encontrado!",
    });
  });

  it("deve recusar cupom fora da vigência com a data no texto", () => {
    const expirado = resolveLocalCoupon(input({ now: new Date("2026-10-01T09:00:00") }));
    const futuro = resolveLocalCoupon(
      input({ now: new Date("2026-08-20T09:00:00"), generatedAt: "2026-08-20T08:00:00" }),
    );

    expect(expirado).toMatchObject({
      reason: "expired",
      message: "Cupom expirado em 30/09/2026 às 23:59!",
    });
    expect(futuro).toMatchObject({
      reason: "not-yet-valid",
      message: "Cupom válido a partir de 01/09/2026 às 00:00!",
    });
  });

  it("deve aceitar cupom sem prazo de validade", () => {
    const found = resolveLocalCoupon(
      input({
        coupons: [localCoupon({ validUntil: null })],
        now: new Date("2030-01-01T09:00:00"),
      }),
    );

    expect(found.outcome).toBe("found");
  });

  it("deve descontar da base do snapshot os resgates já enfileirados", () => {
    // `remainingAtSnapshot` é o que o servidor sabia quando gerou o snapshot; ele
    // não conhece as vendas que ainda estão na fila deste caixa.
    const found = resolveLocalCoupon(
      input({
        coupons: [localCoupon({ remainingAtSnapshot: 3 })],
        queued: new Map([[12, 2]]),
      }),
    );

    expect(found).toMatchObject({ outcome: "found", remainingUses: 1, overLimit: false });
  });

  it("deve ENCONTRAR o cupom estourado, avisando em vez de recusar", () => {
    // Limite de cupom é orçamento de marketing, não estoque: o cliente está no
    // balcão com o panfleto. O estouro sobe na fila e o servidor carimba
    // `over_limit` — recusar aqui custaria a venda inteira.
    const found = resolveLocalCoupon(
      input({
        coupons: [localCoupon({ remainingAtSnapshot: 2 })],
        queued: new Map([[12, 5]]),
      }),
    );

    expect(found).toMatchObject({ outcome: "found", overLimit: true, remainingUses: 0 });
  });

  it("deve tratar limite nulo como ilimitado, nunca como esgotado", () => {
    const found = resolveLocalCoupon(input({ queued: new Map([[12, 900]]) }));

    expect(found).toMatchObject({ outcome: "found", overLimit: false, remainingUses: null });
  });

  it("deve recusar quando o relógio da máquina está atrás da hora do servidor", () => {
    // Queda de energia com a bateria do RTC gasta: a máquina reinicia em 2010, e
    // toda conferência de vigência passa a mentir — cupom vencido volta a valer.
    const refused = resolveLocalCoupon(input({ now: new Date("2010-01-01T09:00:00") }));

    expect(refused).toMatchObject({ outcome: "refused", reason: "unreliable-clock" });
  });

  it("deve tolerar poucos minutos de defasagem contra o servidor", () => {
    // Sem folga, um caixa alguns segundos atrás do servidor recusaria todo cupom
    // do turno. O erro que a conferência existe para pegar é de horas ou de anos.
    const found = resolveLocalCoupon(
      input({
        now: new Date("2026-09-15T07:59:50"),
        generatedAt: "2026-09-15T08:00:00",
      }),
    );

    expect(found.outcome).toBe("found");
  });

  it("deve recusar quando este caixa não tem lista de cupons", () => {
    // Lista ausente (snapshot anterior a esta feature) é diferente de lista
    // vazia: a primeira é "não sei responder", a segunda é "esta loja não tem
    // cupom", e só a segunda pode dizer "não encontrado".
    expect(resolveLocalCoupon(input({ coupons: null }))).toMatchObject({
      outcome: "refused",
      reason: "unavailable",
    });

    expect(resolveLocalCoupon(input({ coupons: [] }))).toMatchObject({
      outcome: "refused",
      reason: "not-found",
    });
  });

  it("deve recusar quando a base local não tem a hora do servidor", () => {
    // Sem a âncora não há como conferir o relógio, e conferir vigência com um
    // relógio sem âncora é o mesmo que não conferir nada.
    expect(resolveLocalCoupon(input({ generatedAt: null }))).toMatchObject({
      outcome: "refused",
      reason: "unavailable",
    });
  });

  it("deve conferir o relógio ANTES de procurar o código", () => {
    // Numa máquina com a data errada, "cupom não encontrado" mandaria o operador
    // procurar o problema no panfleto do cliente em vez de no relógio.
    const refused = resolveLocalCoupon(input({ code: "NAOEXISTE", now: new Date("2010-01-01T09:00:00") }));

    expect(refused).toMatchObject({ reason: "unreliable-clock" });
  });
});

describe("lookupLocalCoupon", () => {
  it("deve compor a base local, a hora do servidor e a fila", async () => {
    // Vigência aberta e snapshot antigo: este caso é sobre a composição das três
    // leituras, e o relógio real da máquina de teste não pode influenciá-lo.
    readMeta.mockImplementation(async (key: string) =>
      key === "coupons"
        ? [localCoupon({ remainingAtSnapshot: 4, validFrom: "2000-01-01T00:00:00", validUntil: null })]
        : "2000-01-02T08:00:00",
    );
    listPendingSales.mockResolvedValue([
      pendingSale("ref-1", saleCoupon(12)),
      pendingSale("ref-2", saleCoupon(12)),
    ]);

    const found = await lookupLocalCoupon("10offset26");

    expect(found).toMatchObject({ outcome: "found", remainingUses: 2 });
    expect(readMeta).toHaveBeenCalledWith("coupons");
    expect(readMeta).toHaveBeenCalledWith("snapshotGeneratedAt");
  });

  it("não deve lançar quando o cupom não existe", async () => {
    // Recusa de cupom é acontecimento normal do balcão, não erro: quem chama
    // mostra a mensagem, não trata exceção.
    readMeta.mockImplementation(async (key: string) => (key === "coupons" ? [] : "2000-01-02T08:00:00"));

    await expect(lookupLocalCoupon("NAOEXISTE")).resolves.toMatchObject({
      outcome: "refused",
      reason: "not-found",
    });
  });
});

describe("writeLocalCoupons", () => {
  it("deve gravar a lista na chave de metadados", async () => {
    await writeLocalCoupons([localCoupon()]);

    expect(writeMeta).toHaveBeenCalledWith("coupons", [localCoupon()]);
  });

  it("deve gravar nulo para apagar a lista do turno anterior", async () => {
    // O snapshot substitui o cadastro por inteiro. Se o backend parar de mandar
    // cupons, a lista velha não pode continuar validando cupom que já não existe.
    await writeLocalCoupons(null);

    expect(writeMeta).toHaveBeenCalledWith("coupons", null);
  });
});

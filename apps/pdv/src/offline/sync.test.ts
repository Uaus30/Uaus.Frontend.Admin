import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingSale, SaleSyncResult } from "./types";

const markPendingSaleAttempted = vi.fn();
const markPendingSaleFailed = vi.fn();
const removePendingSale = vi.fn();
const restoreLocalStock = vi.fn();
const consumeLocalStock = vi.fn();
const listSalesToSync = vi.fn();
const tallyPendingSales = vi.fn();
const apiPost = vi.fn();

vi.mock("./pending-sales", () => ({
  listSalesToSync: (...args: unknown[]) => listSalesToSync(...args),
  markPendingSaleAttempted: (...args: unknown[]) => markPendingSaleAttempted(...args),
  markPendingSaleFailed: (...args: unknown[]) => markPendingSaleFailed(...args),
  removePendingSale: (...args: unknown[]) => removePendingSale(...args),
  tallyPendingSales: (...args: unknown[]) => tallyPendingSales(...args),
}));

vi.mock("./stock", () => ({
  restoreLocalStock: (...args: unknown[]) => restoreLocalStock(...args),
  consumeLocalStock: (...args: unknown[]) => consumeLocalStock(...args),
}));

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  apiPost: (...args: unknown[]) => apiPost(...args),
}));

const { applySyncResults, chunk, readSyncStatus, syncPendingSales, SYNC_BATCH_SIZE } = await import(
  "./sync"
);

/** Monta uma venda da fila. */
function pendingSale(reference: string, offlineNumber = 1): PendingSale {
  return {
    clientReference: reference,
    offlineNumber,
    occurredAt: `2026-07-25T10:0${offlineNumber}:00.000Z`,
    cashRegisterSessionId: 7,
    customerId: null,
    customerDocument: null,
    total: 50,
    discount: 0,
    notes: null,
    items: [{ productId: 1, quantity: 2, unitPrice: 25, productName: "Café" }],
    payments: [
      {
        paymentMethodId: 1,
        paymentMethodInstallmentId: null,
        amount: 50,
        installments: 1,
        transactionFee: 0,
        paymentMethodName: "Dinheiro",
      },
    ],
    status: "pending",
    attempts: 0,
    lastError: null,
    stockApplied: true,
  };
}

/** Monta o desfecho devolvido pela API para uma venda. */
function result(
  reference: string,
  status: SaleSyncResult["status"],
  overrides: Partial<SaleSyncResult> = {},
): SaleSyncResult {
  return { clientReference: reference, status, saleId: 900, message: null, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  tallyPendingSales.mockResolvedValue({ pending: 0, failed: 0 });
});

describe("readSyncStatus", () => {
  it("deve entender o nome do enum", () => {
    expect(readSyncStatus(result("a", "Created"))).toBe("created");
    expect(readSyncStatus(result("a", "Duplicated"))).toBe("duplicated");
    expect(readSyncStatus(result("a", "Rejected"))).toBe("rejected");
  });

  it("deve entender o código numérico do enum", () => {
    // A API serializa pelo nome, mas uma configuração diferente devolveria o
    // código; uma venda gravada não pode ser tratada como recusada por formato.
    expect(readSyncStatus(result("a", 1))).toBe("created");
    expect(readSyncStatus(result("a", 2))).toBe("duplicated");
    expect(readSyncStatus(result("a", 3))).toBe("rejected");
  });

  it("deve tratar status desconhecido como recusa", () => {
    expect(readSyncStatus(result("a", 99))).toBe("rejected");
  });
});

describe("chunk", () => {
  it("deve dividir a fila em lotes do tamanho pedido", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("deve devolver vazio para lista vazia", () => {
    expect(chunk([], 10)).toEqual([]);
  });

  it("deve respeitar o limite do backend", () => {
    // O backend recusa lote acima de 50; o do PDV precisa caber nele.
    expect(SYNC_BATCH_SIZE).toBeLessThanOrEqual(50);
  });
});

describe("applySyncResults", () => {
  it("deve tirar da fila a venda criada", async () => {
    const sale = pendingSale("ref-1");

    const applied = await applySyncResults([sale], [result("ref-1", "Created")]);

    expect(applied).toMatchObject({ created: 1, duplicated: 0, rejected: 0 });
    expect(removePendingSale).toHaveBeenCalledWith("ref-1");
    expect(restoreLocalStock).not.toHaveBeenCalled();
  });

  it("deve tirar da fila a venda que já constava no servidor", async () => {
    // É o lote cuja resposta não chegou ao PDV: a venda está gravada, sair da
    // fila é o desfecho correto.
    const sale = pendingSale("ref-1");

    const applied = await applySyncResults([sale], [result("ref-1", "Duplicated")]);

    expect(applied).toMatchObject({ duplicated: 1 });
    expect(removePendingSale).toHaveBeenCalledWith("ref-1");
  });

  it("deve marcar a recusa com o motivo e devolver o estoque local", async () => {
    const sale = pendingSale("ref-1");

    const applied = await applySyncResults(
      [sale],
      [result("ref-1", "Rejected", { saleId: null, message: "Estoque insuficiente!" })],
    );

    expect(applied).toMatchObject({ rejected: 1 });
    expect(markPendingSaleFailed).toHaveBeenCalledWith(sale, "Estoque insuficiente!");
    // A venda não existe, então o saldo local estava mentindo para baixo.
    expect(restoreLocalStock).toHaveBeenCalledWith([{ productId: 1, quantity: 2 }]);
    expect(removePendingSale).not.toHaveBeenCalled();
  });

  it("não deve devolver o estoque duas vezes em recusa repetida", async () => {
    // A venda já foi recusada antes; o saldo local voltou naquela ocasião.
    const sale = { ...pendingSale("ref-1"), status: "failed" as const, stockApplied: false };

    await applySyncResults([sale], [result("ref-1", "Rejected", { saleId: null })]);

    expect(restoreLocalStock).not.toHaveBeenCalled();
  });

  it("deve redebitar o estoque quando uma venda recusada finalmente entra", async () => {
    // O operador corrigiu a causa e reenviou. O débito original foi desfeito na
    // recusa; sem redebitar, o saldo local ficaria inflado até o próximo snapshot.
    const sale = { ...pendingSale("ref-1"), stockApplied: false };

    await applySyncResults([sale], [result("ref-1", "Created")]);

    expect(consumeLocalStock).toHaveBeenCalledWith([{ productId: 1, quantity: 2 }]);
    expect(removePendingSale).toHaveBeenCalledWith("ref-1");
  });

  it("não deve redebitar o estoque da venda que nunca foi recusada", async () => {
    await applySyncResults([pendingSale("ref-1")], [result("ref-1", "Created")]);

    expect(consumeLocalStock).not.toHaveBeenCalled();
  });

  it("deve usar mensagem padrão quando a API recusa sem motivo", async () => {
    await applySyncResults([pendingSale("ref-1")], [result("ref-1", "Rejected", { message: null })]);

    expect(markPendingSaleFailed).toHaveBeenCalledWith(expect.anything(), "O servidor recusou a venda.");
  });

  it("deve manter na fila a venda ausente da resposta", async () => {
    const sale = pendingSale("ref-1");

    await applySyncResults([sale], []);

    expect(markPendingSaleAttempted).toHaveBeenCalledWith(sale);
    expect(removePendingSale).not.toHaveBeenCalled();
    expect(markPendingSaleFailed).not.toHaveBeenCalled();
  });

  it("deve aplicar desfechos diferentes no mesmo lote", async () => {
    const applied = await applySyncResults(
      [pendingSale("ref-1", 1), pendingSale("ref-2", 2), pendingSale("ref-3", 3)],
      [
        result("ref-1", "Created"),
        result("ref-2", "Rejected", { saleId: null, message: "Produto excluído!" }),
        result("ref-3", "Duplicated"),
      ],
    );

    expect(applied).toEqual({ created: 1, duplicated: 1, rejected: 1 });
  });
});

describe("syncPendingSales", () => {
  it("deve devolver zeros com a fila vazia", async () => {
    listSalesToSync.mockResolvedValue([]);

    const outcome = await syncPendingSales();

    expect(outcome).toEqual({ created: 0, duplicated: 0, rejected: 0, remaining: 0 });
    expect(apiPost).not.toHaveBeenCalled();
  });

  it("deve enviar a fila e contabilizar o resultado", async () => {
    listSalesToSync.mockResolvedValue([pendingSale("ref-1"), pendingSale("ref-2", 2)]);
    apiPost.mockResolvedValue({
      data: {
        syncedAt: "2026-07-25T20:00:00",
        createdCount: 2,
        duplicatedCount: 0,
        rejectedCount: 0,
        results: [result("ref-1", "Created"), result("ref-2", "Created")],
      },
    });

    const outcome = await syncPendingSales();

    expect(outcome).toMatchObject({ created: 2, remaining: 0 });
    expect(apiPost).toHaveBeenCalledWith("/Pdv/sales/sync", {
      sales: expect.arrayContaining([expect.objectContaining({ clientReference: "ref-1" })]),
    });
  });

  it("deve enviar o corpo no formato que a API espera", async () => {
    listSalesToSync.mockResolvedValue([pendingSale("ref-1")]);
    apiPost.mockResolvedValue({ data: { results: [result("ref-1", "Created")] } });

    await syncPendingSales();

    const body = apiPost.mock.calls[0][1] as { sales: Array<Record<string, unknown>> };
    // Os nomes de produto e forma de pagamento são só da fila local; enviá-los
    // faria o backend recusar o corpo.
    expect(body.sales[0].items).toEqual([
      { productId: 1, quantity: 2, unitPrice: 25, discount: 0 },
    ]);
    expect(body.sales[0]).toMatchObject({ clientReference: "ref-1", cashRegisterSessionId: 7 });
  });

  it("deve enviar o desconto do item no lote, inclusive nas vendas antigas da fila", async () => {
    // Duas vendas: uma gravada depois do campo existir, outra de antes.
    // `pendingSales` sobrevive à migração, então a segunda sobe sem o campo e
    // precisa virar zero em vez de `undefined` — o backend recusaria o corpo.
    const comDesconto = pendingSale("ref-1");
    comDesconto.items = [
      { productId: 1, quantity: 2, unitPrice: 8, discount: 2, productName: "Café" },
    ];

    const legada = pendingSale("ref-2", 2);
    legada.items = [
      { productId: 1, quantity: 1, unitPrice: 25, productName: "Café" },
    ] as typeof legada.items;

    listSalesToSync.mockResolvedValue([comDesconto, legada]);
    apiPost.mockResolvedValue({
      data: { results: [result("ref-1", "Created"), result("ref-2", "Created")] },
    });

    await syncPendingSales();

    const body = apiPost.mock.calls[0][1] as { sales: Array<{ items: Array<Record<string, number>> }> };
    expect(body.sales[0].items[0].discount).toBe(2);
    expect(body.sales[1].items[0].discount).toBe(0);
  });

  it("deve enviar o bloco do cupom, sem campanha nenhuma", async () => {
    const comCupom = pendingSale("ref-1");
    comCupom.discount = 10;
    comCupom.coupon = {
      couponId: 12,
      code: "10OFFSET26",
      discountType: 1,
      discountValue: 10,
      baseAmount: 100,
      discountAmount: 10,
      answers: [{ questionId: 7, optionId: 21 }],
    };

    listSalesToSync.mockResolvedValue([comCupom]);
    apiPost.mockResolvedValue({ data: { results: [result("ref-1", "Created")] } });

    await syncPendingSales();

    const body = apiPost.mock.calls[0][1] as { sales: Array<Record<string, unknown>> };
    expect(body.sales[0].coupon).toEqual({
      couponId: 12,
      code: "10OFFSET26",
      discountType: 1,
      discountValue: 10,
      baseAmount: 100,
      discountAmount: 10,
      answers: [{ questionId: 7, optionId: 21 }],
    });
    // O `discountAmount` é PARCELA do `discount`, não adição: somar os dois faria
    // o servidor recusar a venda por total divergente, com o cliente já fora da loja.
    expect(body.sales[0].discount).toBe(10);
    // O PDV nunca soube da campanha — quem fotografa o vínculo é o servidor.
    expect(body.sales[0].coupon).not.toHaveProperty("campaignId");
  });

  it("deve subir venda antiga da fila, sem o campo de cupom, com `null`", async () => {
    // `pendingSales` sobrevive à migração do schema local: há vendas enfileiradas
    // antes desta feature existir, e `undefined` sumiria do JSON.
    const legada = pendingSale("ref-1");
    delete (legada as { coupon?: unknown }).coupon;

    listSalesToSync.mockResolvedValue([legada]);
    apiPost.mockResolvedValue({ data: { results: [result("ref-1", "Created")] } });

    await syncPendingSales();

    const body = apiPost.mock.calls[0][1] as { sales: Array<Record<string, unknown>> };
    expect(body.sales[0].coupon).toBeNull();
  });

  it("não deve perder venda quando a conexão cai no meio da sincronização", async () => {
    const sale = pendingSale("ref-1");
    listSalesToSync.mockResolvedValue([sale]);
    apiPost.mockRejectedValue(new TypeError("Failed to fetch"));
    tallyPendingSales.mockResolvedValue({ pending: 1, failed: 0 });

    const outcome = await syncPendingSales();

    // A rodada não lança: a venda fica na fila para a próxima tentativa.
    expect(outcome).toMatchObject({ created: 0, remaining: 1 });
    expect(markPendingSaleAttempted).toHaveBeenCalledWith(sale);
  });

  it("deve informar quantas vendas continuam na fila", async () => {
    listSalesToSync.mockResolvedValue([pendingSale("ref-1")]);
    apiPost.mockResolvedValue({
      data: { results: [result("ref-1", "Rejected", { saleId: null, message: "Sem estoque" })] },
    });
    tallyPendingSales.mockResolvedValue({ pending: 0, failed: 1 });

    const outcome = await syncPendingSales();

    expect(outcome).toMatchObject({ rejected: 1, remaining: 1 });
  });
});

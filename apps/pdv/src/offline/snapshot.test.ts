import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PdvSnapshot, PendingSale, PendingWriteOff } from "./types";

const apiGet = vi.fn();
const openLocalDatabase = vi.fn();
const clearAll = vi.fn();
const putAll = vi.fn();
const remove = vi.fn();
const writeMeta = vi.fn();
const listPendingSales = vi.fn();
const listPendingWriteOffs = vi.fn();
const consumeLocalStock = vi.fn();

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  apiGet: (...args: unknown[]) => apiGet(...args),
}));

vi.mock("./database", () => ({
  openLocalDatabase: (...args: unknown[]) => openLocalDatabase(...args),
  CATALOG_STORES: ["products", "paymentMethods", "customers"],
  STORE: {
    meta: "meta",
    products: "products",
    paymentMethods: "paymentMethods",
    customers: "customers",
    pendingSales: "pendingSales",
    pendingWriteOffs: "pendingWriteOffs",
  },
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

vi.mock("./idb", () => ({
  clearAll: (...args: unknown[]) => clearAll(...args),
  putAll: (...args: unknown[]) => putAll(...args),
  remove: (...args: unknown[]) => remove(...args),
  getAll: vi.fn(),
  getByKey: vi.fn(),
}));

vi.mock("./meta", () => ({
  writeMeta: (...args: unknown[]) => writeMeta(...args),
}));

vi.mock("./pending-sales", () => ({
  listPendingSales: (...args: unknown[]) => listPendingSales(...args),
}));

vi.mock("./pending-write-offs", () => ({
  listPendingWriteOffs: (...args: unknown[]) => listPendingWriteOffs(...args),
}));

vi.mock("./stock", () => ({
  consumeLocalStock: (...args: unknown[]) => consumeLocalStock(...args),
}));

const { collectPendingStockDebits, installSnapshot, clearLocalCatalog } = await import(
  "./snapshot"
);

/** Snapshot mínimo com o produto 1 valendo R$ 10,00 e 5 unidades no servidor. */
function snapshot(overrides: Partial<PdvSnapshot> = {}): PdvSnapshot {
  return {
    schemaVersion: 1,
    generatedAt: "2026-08-08T10:00:00",
    products: [
      {
        id: 1,
        name: "Café",
        barcode: "789",
        price: 10,
        stock: 5,
        status: 1,
        productGroupId: 1,
      },
    ],
    paymentMethods: [],
    customers: [],
    ...overrides,
  };
}

/** Venda da fila com os itens informados. */
function pendingSale(
  reference: string,
  items: Array<{ productId: number; quantity: number }>,
  overrides: Partial<PendingSale> = {},
): PendingSale {
  return {
    clientReference: reference,
    offlineNumber: 1,
    occurredAt: "2026-08-08T09:00:00",
    cashRegisterSessionId: 7,
    customerId: null,
    customerDocument: null,
    total: 10,
    discount: 0,
    notes: null,
    items: items.map((item) => ({ ...item, unitPrice: 10, productName: `Produto #${item.productId}` })),
    payments: [],
    status: "pending",
    attempts: 0,
    lastError: null,
    stockApplied: true,
    ...overrides,
  };
}

/** Baixa da fila com os itens informados. */
function pendingWriteOff(
  reference: string,
  items: Array<{ productId: number; quantity: number }>,
  overrides: Partial<PendingWriteOff> = {},
): PendingWriteOff {
  return {
    clientReference: reference,
    occurredAt: "2026-08-08T09:30:00",
    reason: 2,
    notes: null,
    items: items.map((item) => ({ ...item, productName: `Produto #${item.productId}` })),
    status: "pending",
    attempts: 0,
    lastError: null,
    stockApplied: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  openLocalDatabase.mockResolvedValue({});
  listPendingSales.mockResolvedValue([]);
  listPendingWriteOffs.mockResolvedValue([]);
});

describe("collectPendingStockDebits", () => {
  it("deve somar os débitos de vendas e baixas por produto", () => {
    // `consumeLocalStock` aplica um movimento por chave: dois débitos do mesmo
    // produto em registros diferentes precisam chegar agregados.
    const debits = collectPendingStockDebits(
      [
        pendingSale("ref-1", [{ productId: 1, quantity: 2 }]),
        pendingSale("ref-2", [
          { productId: 1, quantity: 3 },
          { productId: 2, quantity: 1 },
        ]),
      ],
      [pendingWriteOff("ref-3", [{ productId: 2, quantity: 4 }])],
    );

    expect(debits).toEqual([
      { productId: 1, quantity: 5 },
      { productId: 2, quantity: 5 },
    ]);
  });

  it("não deve debitar movimento recusado (estoque já devolvido)", () => {
    // Uma venda/baixa recusada teve o saldo devolvido quando saiu do ar
    // (`stockApplied: false`); re-aplicar o débito dela subestimaria o saldo.
    const debits = collectPendingStockDebits(
      [pendingSale("ref-1", [{ productId: 1, quantity: 2 }], { stockApplied: false })],
      [pendingWriteOff("ref-2", [{ productId: 2, quantity: 1 }], { stockApplied: false })],
    );

    expect(debits).toEqual([]);
  });

  it("deve devolver vazio com as filas vazias", () => {
    expect(collectPendingStockDebits([], [])).toEqual([]);
  });
});

describe("installSnapshot", () => {
  it("deve re-aplicar os débitos da fila pendente sobre o estoque instalado", async () => {
    // Regressão: instalar o snapshot com fila pendente sobrescrevia o estoque
    // local com o do servidor — que ainda não conhece as vendas da fila. O
    // débito dessas vendas se perdia, o saldo local inflava e a venda offline
    // seguinte era recusada na sincronização com o cliente já fora da loja.
    listPendingSales.mockResolvedValue([pendingSale("ref-1", [{ productId: 1, quantity: 3 }])]);

    await installSnapshot(snapshot());

    expect(consumeLocalStock).toHaveBeenCalledWith([{ productId: 1, quantity: 3 }]);

    // O débito acontece depois da carga do catálogo (senão seria apagado) e
    // antes da MARCA de atualização (senão uma falha no meio deixaria a base
    // marcada como confiável sem os débitos). A marca é procurada pelo nome da
    // chave: `writeMeta` também grava os cupons, que são carga e não marca, e
    // olhar só a primeira chamada testaria a ordem de outra coisa.
    const markOrder = writeMeta.mock.invocationCallOrder[
      writeMeta.mock.calls.findIndex((call) => call[0] === "snapshotSchemaVersion")
    ];
    const putOrder = putAll.mock.invocationCallOrder[0];
    const consumeOrder = consumeLocalStock.mock.invocationCallOrder[0];
    expect(putOrder).toBeLessThan(consumeOrder);
    expect(consumeOrder).toBeLessThan(markOrder);
  });

  it("não deve tocar o estoque com as filas vazias", async () => {
    await installSnapshot(snapshot());

    expect(consumeLocalStock).not.toHaveBeenCalled();
    expect(writeMeta).toHaveBeenCalledWith("snapshotSchemaVersion", 1);
  });

  it("deve levar os cupons com o questionário já resolvido para a base local", async () => {
    // É o que permite encontrar a campanha pelo CÓDIGO DO CUPOM sem rede. Repare
    // que nada aqui menciona campanha: o PDV nunca sabe de onde as perguntas vêm.
    const result = await installSnapshot(
      snapshot({
        coupons: [
          {
            couponId: 12,
            code: "10offset26",
            discountType: "Percentage",
            discountValue: 10,
            validFrom: "2026-09-01T00:00:00",
            validUntil: "2026-09-30T23:59:59",
            remainingAtSnapshot: 40,
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
          },
        ],
      }),
    );

    expect(result.coupons).toBe(1);
    expect(writeMeta).toHaveBeenCalledWith("coupons", [
      expect.objectContaining({
        code: "10OFFSET26",
        discountType: 1,
        remainingAtSnapshot: 40,
        questions: [expect.objectContaining({ questionId: 7 })],
      }),
    ]);
  });

  it("deve apagar a lista de cupons quando o snapshot não traz o campo", async () => {
    // Backend anterior a esta feature, ou cupons desligados. O snapshot substitui
    // o cadastro por inteiro — uma lista sobrevivente validaria offline um cupom
    // que o servidor já não conhece. `null` é diferente de `[]` de propósito: só
    // ele significa "este caixa não sabe responder sobre cupons".
    await installSnapshot(snapshot());

    expect(writeMeta).toHaveBeenCalledWith("coupons", null);
  });

  it("não deve subir a versão do banco local por causa dos cupons", async () => {
    // Os cupons vão para uma CHAVE da store `meta`, nunca para uma store nova:
    // store nova exigiria DATABASE_VERSION 3, e a migração apagaria products,
    // paymentMethods e customers de todo caixa da rede.
    await installSnapshot(snapshot({ coupons: [] }));

    expect(putAll).not.toHaveBeenCalledWith({}, "coupons", expect.anything());
    expect(clearAll).toHaveBeenCalledWith({}, ["products", "paymentMethods", "customers"]);
  });

  it("não deve re-aplicar débito de venda recusada", async () => {
    listPendingSales.mockResolvedValue([
      pendingSale("ref-1", [{ productId: 1, quantity: 3 }], {
        status: "failed",
        stockApplied: false,
      }),
    ]);

    await installSnapshot(snapshot());

    expect(consumeLocalStock).not.toHaveBeenCalled();
  });
});

describe("clearLocalCatalog", () => {
  it("deve apagar só o cadastro e as marcas do snapshot, nunca as filas", async () => {
    // O logout limpa dados pessoais de clientes, mas movimento que o servidor
    // não conhece jamais é apagado — perder a fila é perder venda.
    await clearLocalCatalog();

    expect(clearAll).toHaveBeenCalledWith({}, ["products", "paymentMethods", "customers"]);
    expect(remove).toHaveBeenCalledWith({}, "meta", "snapshotDownloadedAt");
    expect(remove).toHaveBeenCalledWith({}, "meta", "snapshotGeneratedAt");
    expect(remove).toHaveBeenCalledWith({}, "meta", "snapshotSchemaVersion");
    expect(remove).not.toHaveBeenCalledWith({}, "meta", "offlineSaleSequence");
  });

  it("deve apagar os cupons, que `clearAll` das stores de cadastro não alcança", async () => {
    // Regressão por construção: os cupons moram numa chave de `meta`, que é uma
    // store PRESERVADA. Sem esta remoção explícita, a lista de cupons e as
    // perguntas da campanha do operador anterior sobreviveriam ao logout —
    // exatamente o que esta limpeza existe para impedir.
    await clearLocalCatalog();

    expect(remove).toHaveBeenCalledWith({}, "meta", "coupons");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { resetLocalDatabase, toLocalTimestamp } from "@/test/local-database";
import { listLocalPaymentMethods, listLocalProducts, searchLocalCustomers } from "./catalog";
import { lookupLocalCoupon } from "./coupons";
import { META_KEY, STORE, openLocalDatabase } from "./database";
import { putAll } from "./idb";
import { readLocalDatabaseState, readMeta, writeMeta } from "./meta";
import { listPendingSales, savePendingSale } from "./pending-sales";
import { savePendingWriteOff } from "./pending-write-offs";
import { clearLocalCatalog, installSnapshot } from "./snapshot";
import type { LocalProduct, PdvSnapshot, PendingSale, PendingWriteOff } from "./types";

/**
 * A instalação do snapshot contra um IndexedDB de verdade: **o que ela esvazia e
 * o que ela preserva**.
 *
 * A regra é o critério da base local — some o que é cópia descartável do
 * servidor, fica o que só existe aqui. Errar para um lado deixa no caixa um
 * produto que o admin excluiu; errar para o outro apaga venda que ninguém mais
 * tem. O caso mais delicado é o estoque: o snapshot traz o saldo que o servidor
 * conhece, e o servidor **não conhece a fila** — sem re-aplicar os débitos
 * pendentes, instalar o snapshot ressuscita saldo que já saiu do balcão.
 *
 * `snapshot.test.ts` cobre a mesma instalação com dublês, olhando a ordem das
 * chamadas. Aqui o que se olha é o dado que sobrou na base.
 */

/** Uma hora atrás, no formato local sem fuso que o backend usa. */
const GENERATED_AT = toLocalTimestamp(new Date(Date.now() - 60 * 60 * 1000));

/** Snapshot com o produto 1 valendo R$ 25,00 e 10 unidades **no servidor**. */
function snapshot(overrides: Partial<PdvSnapshot> = {}): PdvSnapshot {
  return {
    schemaVersion: 3,
    generatedAt: GENERATED_AT,
    products: [{ id: 1, name: "Café", barcode: "789", price: 25, stock: 10, status: 2, productGroupId: 1 }],
    paymentMethods: [{ id: 1, name: "Dinheiro", installments: [] }],
    customers: [{ id: 1, name: "Ana Souza", document: "12345678901", phone: null }],
    ...overrides,
  };
}

/** Venda na fila, debitando `quantity` do produto 1. */
function pendingSale(reference: string, quantity: number, overrides: Partial<PendingSale> = {}): PendingSale {
  return {
    clientReference: reference,
    offlineNumber: 1,
    occurredAt: "2026-08-15T17:34:12",
    cashRegisterSessionId: 7,
    customerId: null,
    customerDocument: null,
    total: 25 * quantity,
    discount: 0,
    notes: null,
    items: [{ productId: 1, quantity, unitPrice: 25, productName: "Café" }],
    payments: [],
    status: "pending",
    attempts: 0,
    lastError: null,
    stockApplied: true,
    ...overrides,
  };
}

/** Baixa na fila, debitando `quantity` do produto 1. */
function pendingWriteOff(reference: string, quantity: number): PendingWriteOff {
  return {
    clientReference: reference,
    occurredAt: "2026-08-15T17:40:00",
    reason: 2,
    notes: null,
    items: [{ productId: 1, quantity, productName: "Café" }],
    status: "pending",
    attempts: 0,
    lastError: null,
    stockApplied: true,
  };
}

/** Cupom vigente agora, com o questionário da campanha já resolvido. */
function snapshotCoupon() {
  return {
    couponId: 12,
    code: "bemvindo",
    discountType: "Percentage",
    discountValue: 10,
    validFrom: toLocalTimestamp(new Date(Date.now() - 24 * 60 * 60 * 1000)),
    validUntil: toLocalTimestamp(new Date(Date.now() + 24 * 60 * 60 * 1000)),
    remainingAtSnapshot: 40,
    questions: [{ questionId: 7, label: "Como conheceu a loja?", isRequired: true, options: [] }],
  };
}

/** Estoque local do produto 1 depois da instalação. */
async function localStock(productId: number): Promise<number | undefined> {
  return (await listLocalProducts()).find((product: LocalProduct) => product.id === productId)?.stock;
}

beforeEach(() => {
  resetLocalDatabase();
});

describe("installSnapshot: o que ele esvazia", () => {
  it("deve substituir o cadastro por inteiro, e não mesclar", async () => {
    // Um produto excluído no admin precisa desaparecer do caixa. Mesclagem
    // incremental deixaria o produto morto vendável com o preço de antes.
    const db = await openLocalDatabase();
    await putAll<LocalProduct>(db, STORE.products, [
      {
        id: 99,
        name: "Fora de linha",
        barcode: "",
        price: 5,
        stock: 3,
        status: 2,
        productGroupId: 1,
        searchName: "fora de linha",
      },
    ]);

    await installSnapshot(snapshot());

    expect((await listLocalProducts()).map((product) => product.id)).toEqual([1]);
    expect(await listLocalPaymentMethods()).toHaveLength(1);
    expect(await searchLocalCustomers("ana")).toHaveLength(1);
  });

  it("deve apagar a lista de cupons quando o snapshot não traz o campo", async () => {
    // Ausência e lista vazia são coisas diferentes: só a ausência autoriza o
    // caixa a dizer "não sei responder sobre cupons". Uma lista sobrevivente
    // validaria offline um cupom que o servidor já não conhece.
    await installSnapshot(snapshot({ coupons: [snapshotCoupon()] }));
    await installSnapshot(snapshot());

    expect(await readMeta(META_KEY.coupons)).toBeNull();
    expect(await lookupLocalCoupon("BEMVINDO")).toMatchObject({ outcome: "refused", reason: "unavailable" });
  });
});

describe("installSnapshot: o que ele preserva", () => {
  it("não deve tocar a fila nem os metadados que só existem no caixa", async () => {
    // A fila contém venda que o servidor ainda não conhece; o sequencial do
    // cupom provisório e a sessão de caixa guardada não têm de onde ser
    // recuperados sem internet. Baixar o snapshot é rotina de abertura de turno
    // — se ela levasse essas três coisas, o custo apareceria como venda perdida.
    await savePendingSale(pendingSale("checkout-1", 2));
    await writeMeta(META_KEY.offlineSaleSequence, 14);
    await writeMeta(META_KEY.cashRegisterSession, { id: 7 });

    await installSnapshot(snapshot());

    expect((await listPendingSales()).map((sale) => sale.clientReference)).toEqual(["checkout-1"]);
    expect(await readMeta<number>(META_KEY.offlineSaleSequence)).toBe(14);
    expect(await readMeta<{ id: number }>(META_KEY.cashRegisterSession)).toEqual({ id: 7 });
  });

  it("deve re-aplicar sobre o estoque do servidor os débitos que a fila já fez", async () => {
    // O servidor gerou o snapshot sem saber da venda presa aqui: ele diz 10, mas
    // 3 unidades já saíram do balcão. Aceitar o saldo como veio inflaria a
    // projeção local e a venda offline seguinte seria recusada na sincronização,
    // com o cliente já fora da loja.
    await savePendingSale(pendingSale("checkout-1", 3));

    await installSnapshot(snapshot());

    expect(await localStock(1)).toBe(7);
  });

  it("deve somar os débitos de venda e de baixa do mesmo produto", async () => {
    // Os movimentos são aplicados um por produto: dois registros diferentes do
    // mesmo item precisam chegar agregados, senão o segundo sobrescreveria o
    // primeiro em vez de somar.
    await savePendingSale(pendingSale("checkout-1", 3));
    await savePendingWriteOff(pendingWriteOff("baixa-1", 2));

    await installSnapshot(snapshot());

    expect(await localStock(1)).toBe(5);
  });

  it("não deve re-aplicar o débito de venda recusada", async () => {
    // A recusa já devolveu o saldo (`stockApplied: false`). Debitar de novo
    // subestimaria o estoque e bloquearia venda de produto que está na prateleira.
    await savePendingSale(pendingSale("checkout-1", 3, { status: "failed", stockApplied: false }));

    await installSnapshot(snapshot());

    expect(await localStock(1)).toBe(10);
  });

  it("deve gravar as marcas que dizem que a base pode ser usada offline", async () => {
    const result = await installSnapshot(snapshot());

    const state = await readLocalDatabaseState();
    expect(state.generatedAt).toBe(GENERATED_AT);
    expect(state.schemaVersion).toBe(3);
    expect(state.downloadedAt).not.toBeNull();
    expect(result).toMatchObject({ products: 1, paymentMethods: 1, customers: 1, coupons: 0 });
  });
});

describe("cupom na base local depois do snapshot", () => {
  it("deve achar a campanha pelo código do cupom, sem rede", async () => {
    // O questionário vem resolvido do servidor. Repare que nada aqui menciona
    // campanha: é isso que mantém offline, fila e comprovante estáveis a
    // qualquer evolução do modelo de campanha.
    await installSnapshot(snapshot({ coupons: [snapshotCoupon()] }));

    // O operador digita como está no panfleto; a carga normalizou para maiúsculas.
    const lookup = await lookupLocalCoupon("bemvindo");

    expect(lookup).toMatchObject({ outcome: "found", remainingUses: 40, overLimit: false });
    if (lookup.outcome !== "found") throw new Error("cupom deveria ter sido encontrado");
    expect(lookup.coupon.questions[0].label).toBe("Como conheceu a loja?");
    expect(lookup.coupon).not.toHaveProperty("campaignId");
  });

  it("deve descontar da estimativa os resgates já enfileirados neste caixa", async () => {
    // `remainingAtSnapshot` é o que o servidor sabia, não saldo corrente: sem
    // subtrair a fila, dez vendas offline com o mesmo cupom continuariam
    // anunciando 40 usos restantes.
    await installSnapshot(snapshot({ coupons: [{ ...snapshotCoupon(), remainingAtSnapshot: 1 }] }));
    await savePendingSale(
      pendingSale("checkout-1", 1, {
        coupon: {
          couponId: 12,
          code: "BEMVINDO",
          discountType: 1,
          discountValue: 10,
          baseAmount: 25,
          discountAmount: 2.5,
          answers: [],
        },
      }),
    );

    expect(await lookupLocalCoupon("BEMVINDO")).toMatchObject({ remainingUses: 0, overLimit: true });
  });
});

describe("clearLocalCatalog", () => {
  it("deve apagar cadastro, cupons e marcas, mantendo a fila e o sequencial", async () => {
    // É o logout: some o que é dado pessoal do cliente e o que o operador
    // anterior enxergava. Movimento que o servidor não conhece nunca é apagado —
    // a saída já é bloqueada enquanto houver pendência.
    await installSnapshot(snapshot({ coupons: [snapshotCoupon()] }));
    await savePendingSale(pendingSale("checkout-1", 1));
    await writeMeta(META_KEY.offlineSaleSequence, 14);

    await clearLocalCatalog();

    expect(await listLocalProducts()).toEqual([]);
    expect(await searchLocalCustomers("ana")).toEqual([]);
    // Os cupons moram numa chave da store `meta`, que é PRESERVADA: só a linha
    // explícita de `clearLocalCatalog` os alcança. Sem ela, as perguntas da
    // campanha do operador anterior continuariam legíveis depois do logout.
    expect(await readMeta(META_KEY.coupons)).toBeNull();
    expect(await lookupLocalCoupon("BEMVINDO")).toMatchObject({ outcome: "refused" });
    // O que só existe aqui fica.
    expect(await listPendingSales()).toHaveLength(1);
    expect(await readMeta<number>(META_KEY.offlineSaleSequence)).toBe(14);
  });

  it("deve deixar a base sem marca de atualização, bloqueando a venda offline", async () => {
    // Sem as marcas, `readLocalDatabaseState` volta a zero e o PDV sabe que não
    // pode confiar na base local para vender sem internet.
    await installSnapshot(snapshot());

    await clearLocalCatalog();

    expect(await readLocalDatabaseState()).toEqual({
      downloadedAt: null,
      generatedAt: null,
      schemaVersion: null,
    });
  });
});

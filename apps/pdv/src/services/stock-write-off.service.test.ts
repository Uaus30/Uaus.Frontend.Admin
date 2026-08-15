import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegisterStockWriteOffInput } from "@workspace/api-client-react";
import type { PendingWriteOff } from "@/offline";

const registerStockWriteOffRequest = vi.fn();

/** Erro que o cliente HTTP lança quando o servidor **respondeu** recusando. */
class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  ApiError,
  registerStockWriteOff: (...args: unknown[]) => registerStockWriteOffRequest(...args),
  // `sales.service` é importado por este módulo (reuso de `toLocalTimestamp`,
  // `newClientReference` e `LocalStockError`) e puxa o resto do cliente HTTP.
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  cancelSale: vi.fn(),
}));

const checkLocalStock = vi.fn();
const consumeLocalStock = vi.fn();
const savePendingWriteOff = vi.fn();

vi.mock("@/offline", () => ({
  checkLocalStock: (...args: unknown[]) => checkLocalStock(...args),
  consumeLocalStock: (...args: unknown[]) => consumeLocalStock(...args),
  savePendingWriteOff: (...args: unknown[]) => savePendingWriteOff(...args),
  // Usados por `sales.service`, que entra junto na cadeia de importação.
  nextOfflineSaleNumber: vi.fn(),
  savePendingSale: vi.fn(),
}));

const { registerWriteOff } = await import("./stock-write-off.service");
const { LocalStockError } = await import("./sales.service");

/** Motivo "Perda" (enum StockWriteOffReason do backend). */
const LOSS = 2;

/** Payload mínimo de uma baixa. */
function payload(overrides: Record<string, unknown> = {}) {
  return {
    reason: LOSS,
    items: [
      { productId: 1, quantity: 2, productName: "Café" },
      { productId: 2, quantity: 1, productName: "Caneta" },
    ],
    ...overrides,
  };
}

/** Corpo enviado ao servidor na chamada de número `index`. */
function sentBody(index = 0): RegisterStockWriteOffInput {
  return registerStockWriteOffRequest.mock.calls[index][0] as RegisterStockWriteOffInput;
}

/** Baixa gravada na fila offline na chamada de número `index`. */
function queuedWriteOff(index = 0): PendingWriteOff {
  return savePendingWriteOff.mock.calls[index][0] as PendingWriteOff;
}

beforeEach(() => {
  vi.clearAllMocks();
  checkLocalStock.mockResolvedValue([]);
  registerStockWriteOffRequest.mockResolvedValue({ id: 900, occurredAt: "2026-07-25T17:34:12" });
});

describe("registerWriteOff online", () => {
  it("deve gravar a baixa numa única requisição", async () => {
    const saved = await registerWriteOff(payload());

    expect(registerStockWriteOffRequest).toHaveBeenCalledTimes(1);
    expect(saved).toMatchObject({ id: 900, offline: false, reason: LOSS, totalQuantity: 3 });
  });

  it("não deve enviar sessão de caixa", async () => {
    await registerWriteOff(payload());

    // Baixa é movimento de estoque, não de dinheiro: quem resolve a sessão é o
    // servidor, e só quando a empresa usa controle de caixa.
    expect(sentBody()).not.toHaveProperty("cashRegisterSessionId");
  });

  it("deve reutilizar a chave de idempotência informada em todas as tentativas", async () => {
    // Regressão: a chave era gerada a cada chamada, então a retentativa manual
    // (após um 504 do proxy com a baixa já gravada) subia com chave nova e o
    // servidor baixava o estoque duas vezes.
    registerStockWriteOffRequest.mockRejectedValueOnce(new ApiError("Gateway Timeout", 504));

    await expect(
      registerWriteOff(payload(), { clientReference: "chave-do-rascunho" }),
    ).rejects.toThrow("Gateway Timeout");
    await registerWriteOff(payload(), { clientReference: "chave-do-rascunho" });

    expect(sentBody(0).clientReference).toBe("chave-do-rascunho");
    expect(sentBody(1).clientReference).toBe("chave-do-rascunho");
  });

  it("deve enviar a chave de idempotência e o momento local da baixa", async () => {
    await registerWriteOff(payload());

    const body = sentBody();
    expect(body.clientReference).toBeTruthy();
    // Horário local sem fuso: `toISOString()` deixaria a baixa 3h adiantada.
    expect(body.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(body.occurredAt).not.toMatch(/[Zz]|[+-]\d{2}:\d{2}$/);
  });

  it("deve enviar só produto e quantidade em cada item", async () => {
    await registerWriteOff(payload());

    expect(sentBody().items).toEqual([
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ]);
  });

  it("deve limpar a observação em branco", async () => {
    await registerWriteOff(payload({ notes: "   " }));

    expect(sentBody().notes).toBeNull();
  });

  it("deve debitar o estoque local da baixa gravada no servidor", async () => {
    await registerWriteOff(payload());

    // Sem isso o PDV continuaria vendendo offline o que acabou de ser perdido.
    expect(consumeLocalStock).toHaveBeenCalledWith([
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ]);
  });

  it("deve propagar a recusa do servidor sem enfileirar a baixa", async () => {
    registerStockWriteOffRequest.mockRejectedValue(new ApiError("Estoque insuficiente!"));

    await expect(registerWriteOff(payload())).rejects.toThrow("Estoque insuficiente");

    // O servidor respondeu "não": enfileirar só adiaria o mesmo "não".
    expect(savePendingWriteOff).not.toHaveBeenCalled();
    expect(consumeLocalStock).not.toHaveBeenCalled();
  });

  it("deve enfileirar quando a conexão cai no meio da requisição", async () => {
    registerStockWriteOffRequest.mockRejectedValue(new TypeError("Failed to fetch"));

    const saved = await registerWriteOff(payload());

    // Entre perder a baixa e guardá-la para sincronizar, guardar é melhor.
    expect(saved).toMatchObject({ id: null, offline: true });
    expect(savePendingWriteOff).toHaveBeenCalledTimes(1);
  });
});

describe("registerWriteOff offline", () => {
  it("não deve tocar a rede", async () => {
    await registerWriteOff(payload(), { offline: true });

    expect(registerStockWriteOffRequest).not.toHaveBeenCalled();
  });

  it("deve gravar a baixa na fila pronta para reenvio", async () => {
    const saved = await registerWriteOff(payload({ notes: " caiu no chão " }), { offline: true });

    expect(saved).toMatchObject({ id: null, offline: true, totalQuantity: 3 });
    expect(queuedWriteOff()).toMatchObject({
      reason: LOSS,
      notes: "caiu no chão",
      status: "pending",
      attempts: 0,
      lastError: null,
      stockApplied: true,
    });
  });

  it("deve guardar o momento real da baixa, não o da sincronização", async () => {
    const before = new Date();

    await registerWriteOff(payload(), { offline: true });

    // Regressão conhecida: uma venda entrou 3h adiantada por causa de UTC. A
    // baixa carrega a hora do balcão, em formato local e sem fuso.
    const occurredAt = queuedWriteOff().occurredAt as string;
    expect(occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    expect(new Date(occurredAt).getHours()).toBe(before.getHours());
  });

  it("deve guardar na fila o nome dos produtos", async () => {
    await registerWriteOff(payload(), { offline: true });

    // A lista de pendências precisa do nome, e a base local pode ter mudado
    // quando a baixa subir.
    expect(queuedWriteOff().items[0].productName).toBe("Café");
  });

  it("deve nomear o produto pelo ID quando o nome não vem", async () => {
    await registerWriteOff({ reason: LOSS, items: [{ productId: 9, quantity: 1 }] }, { offline: true });

    expect(queuedWriteOff().items[0].productName).toBe("Produto #9");
  });

  it("deve gravar a baixa antes de debitar o estoque", async () => {
    await registerWriteOff(payload(), { offline: true });

    // Ordem inversa deixaria o estoque debitado por uma baixa que não existe.
    expect(savePendingWriteOff.mock.invocationCallOrder[0]).toBeLessThan(
      consumeLocalStock.mock.invocationCallOrder[0],
    );
  });

  it("deve recusar a baixa que não cabe no estoque local", async () => {
    checkLocalStock.mockResolvedValue([
      { productId: 1, productName: "Café", requested: 2, available: 1 },
    ]);

    await expect(registerWriteOff(payload(), { offline: true })).rejects.toBeInstanceOf(
      LocalStockError,
    );

    // Nada é gravado: o backend recusa baixa acima do saldo, e enfileirar uma
    // baixa condenada só adiaria a recusa para a sincronização.
    expect(savePendingWriteOff).not.toHaveBeenCalled();
    expect(consumeLocalStock).not.toHaveBeenCalled();
  });

  it("deve informar no erro qual produto faltou", async () => {
    checkLocalStock.mockResolvedValue([
      { productId: 1, productName: "Café", requested: 5, available: 2 },
    ]);

    await expect(registerWriteOff(payload(), { offline: true })).rejects.toThrow(/Café.*5.*2/);
  });

  it("deve gerar uma referência diferente para cada baixa", async () => {
    await registerWriteOff(payload(), { offline: true });
    await registerWriteOff(payload(), { offline: true });

    expect(queuedWriteOff(0).clientReference).not.toBe(queuedWriteOff(1).clientReference);
  });
});

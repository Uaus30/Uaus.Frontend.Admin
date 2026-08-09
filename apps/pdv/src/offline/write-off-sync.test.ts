import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingWriteOff } from "./types";

const listWriteOffsToSync = vi.fn();
const markPendingWriteOffAttempted = vi.fn();
const markPendingWriteOffFailed = vi.fn();
const removePendingWriteOff = vi.fn();
const tallyPendingWriteOffs = vi.fn();
const restoreLocalStock = vi.fn();
const consumeLocalStock = vi.fn();
const registerStockWriteOff = vi.fn();

/** Erro que o cliente HTTP lança quando o servidor **respondeu** recusando. */
class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

vi.mock("./pending-write-offs", () => ({
  listWriteOffsToSync: (...args: unknown[]) => listWriteOffsToSync(...args),
  markPendingWriteOffAttempted: (...args: unknown[]) => markPendingWriteOffAttempted(...args),
  markPendingWriteOffFailed: (...args: unknown[]) => markPendingWriteOffFailed(...args),
  removePendingWriteOff: (...args: unknown[]) => removePendingWriteOff(...args),
  tallyPendingWriteOffs: (...args: unknown[]) => tallyPendingWriteOffs(...args),
}));

vi.mock("./stock", () => ({
  restoreLocalStock: (...args: unknown[]) => restoreLocalStock(...args),
  consumeLocalStock: (...args: unknown[]) => consumeLocalStock(...args),
}));

vi.mock("@workspace/api-client-react", () => ({
  ApiError,
  registerStockWriteOff: (...args: unknown[]) => registerStockWriteOff(...args),
}));

const { buildWriteOffRequestBody, classifyWriteOffFailure, syncPendingWriteOffs } = await import(
  "./write-off-sync"
);

/** Monta uma baixa da fila. */
function pendingWriteOff(
  reference: string,
  overrides: Partial<PendingWriteOff> = {},
): PendingWriteOff {
  return {
    clientReference: reference,
    occurredAt: "2026-07-25T17:34:12",
    // Perda (enum StockWriteOffReason do backend).
    reason: 2,
    notes: null,
    items: [{ productId: 1, quantity: 2, productName: "Café" }],
    status: "pending",
    attempts: 0,
    lastError: null,
    stockApplied: true,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  tallyPendingWriteOffs.mockResolvedValue({ pending: 0, failed: 0 });
  registerStockWriteOff.mockResolvedValue({ id: 900 });
});

describe("classifyWriteOffFailure", () => {
  it("deve tratar recusa do servidor como definitiva", () => {
    // O servidor respondeu "não": insistir só repetiria a mesma recusa.
    expect(classifyWriteOffFailure(new ApiError("Estoque insuficiente!"))).toBe("rejected");
  });

  it.each([400, 404, 409, 422])("deve tratar %i como recusa de regra de negócio", (status) => {
    expect(classifyWriteOffFailure(new ApiError("Recusada!", status))).toBe("rejected");
  });

  it.each([401, 408, 429, 500, 502, 503, 504])(
    "deve tratar %i como transiente e manter a baixa na fila",
    (status) => {
      // Regressão: qualquer ApiError era tratado como recusa permanente. Um 401
      // (token expirado no meio da rodada) ou um 502 do proxy marcava a baixa
      // como "Recusada" e devolvia ao estoque local mercadoria que de fato saiu
      // da prateleira — o servidor nem chegou a avaliar a baixa.
      expect(classifyWriteOffFailure(new ApiError("Falha de infraestrutura", status))).toBe(
        "retry",
      );
    },
  );

  it("deve tratar falha de rede como reenviável", () => {
    expect(classifyWriteOffFailure(new TypeError("Failed to fetch"))).toBe("retry");
  });

  it("deve tratar erro desconhecido como reenviável", () => {
    // Na dúvida a baixa fica na fila: perder movimento de estoque é pior do que
    // tentar de novo.
    expect(classifyWriteOffFailure("algo estranho")).toBe("retry");
  });
});

describe("buildWriteOffRequestBody", () => {
  it("deve enviar a referência de idempotência e o momento real da baixa", () => {
    const body = buildWriteOffRequestBody(pendingWriteOff("ref-1"));

    // Sem a referência, um reenvio duplicaria a baixa; sem `occurredAt`, a baixa
    // feita durante a queda entraria com a hora em que a conexão voltou.
    expect(body.clientReference).toBe("ref-1");
    expect(body.occurredAt).toBe("2026-07-25T17:34:12");
    expect(body.occurredAt).not.toMatch(/[Zz]|[+-]\d{2}:\d{2}$/);
  });

  it("deve enviar só o que a API espera de cada item", () => {
    // O nome do produto é só da fila local; enviá-lo faria o backend recusar.
    expect(buildWriteOffRequestBody(pendingWriteOff("ref-1")).items).toEqual([
      { productId: 1, quantity: 2 },
    ]);
  });

  it("deve levar motivo e observação", () => {
    const body = buildWriteOffRequestBody(
      pendingWriteOff("ref-1", { reason: 3, notes: "doado à creche" }),
    );

    expect(body).toMatchObject({ reason: 3, notes: "doado à creche" });
  });
});

describe("syncPendingWriteOffs", () => {
  it("deve devolver zeros com a fila vazia", async () => {
    listWriteOffsToSync.mockResolvedValue([]);

    expect(await syncPendingWriteOffs()).toEqual({ sent: 0, rejected: 0, remaining: 0 });
    expect(registerStockWriteOff).not.toHaveBeenCalled();
  });

  it("deve tirar da fila a baixa gravada", async () => {
    listWriteOffsToSync.mockResolvedValue([pendingWriteOff("ref-1")]);

    const outcome = await syncPendingWriteOffs();

    expect(outcome).toMatchObject({ sent: 1, rejected: 0, remaining: 0 });
    expect(removePendingWriteOff).toHaveBeenCalledWith("ref-1");
    expect(restoreLocalStock).not.toHaveBeenCalled();
  });

  it("deve enviar uma requisição por baixa", async () => {
    // Não existe endpoint de lote para baixa: a idempotência por referência é o
    // que torna o reenvio uma a uma seguro.
    listWriteOffsToSync.mockResolvedValue([pendingWriteOff("ref-1"), pendingWriteOff("ref-2")]);

    await syncPendingWriteOffs();

    expect(registerStockWriteOff).toHaveBeenCalledTimes(2);
  });

  it("deve marcar a recusa com o motivo e devolver o estoque local", async () => {
    const writeOff = pendingWriteOff("ref-1");
    listWriteOffsToSync.mockResolvedValue([writeOff]);
    registerStockWriteOff.mockRejectedValue(new ApiError("Saldo em lote insuficiente!"));
    tallyPendingWriteOffs.mockResolvedValue({ pending: 0, failed: 1 });

    const outcome = await syncPendingWriteOffs();

    expect(outcome).toMatchObject({ sent: 0, rejected: 1, remaining: 1 });
    expect(markPendingWriteOffFailed).toHaveBeenCalledWith(writeOff, "Saldo em lote insuficiente!");
    // A baixa não existe, então o saldo local estava mentindo para baixo.
    expect(restoreLocalStock).toHaveBeenCalledWith([{ productId: 1, quantity: 2 }]);
    expect(removePendingWriteOff).not.toHaveBeenCalled();
  });

  it("não deve devolver o estoque duas vezes em recusa repetida", async () => {
    // Já foi recusada antes; o saldo local voltou naquela ocasião.
    listWriteOffsToSync.mockResolvedValue([pendingWriteOff("ref-1", { stockApplied: false })]);
    registerStockWriteOff.mockRejectedValue(new ApiError("Produto excluído!"));

    await syncPendingWriteOffs();

    expect(restoreLocalStock).not.toHaveBeenCalled();
  });

  it("deve redebitar o estoque quando uma baixa recusada finalmente entra", async () => {
    // O operador corrigiu a causa e reenviou. Sem redebitar, o saldo local
    // ficaria inflado até o próximo snapshot.
    listWriteOffsToSync.mockResolvedValue([pendingWriteOff("ref-1", { stockApplied: false })]);

    await syncPendingWriteOffs();

    expect(consumeLocalStock).toHaveBeenCalledWith([{ productId: 1, quantity: 2 }]);
    expect(removePendingWriteOff).toHaveBeenCalledWith("ref-1");
  });

  it("não deve redebitar o estoque da baixa que nunca foi recusada", async () => {
    listWriteOffsToSync.mockResolvedValue([pendingWriteOff("ref-1")]);

    await syncPendingWriteOffs();

    expect(consumeLocalStock).not.toHaveBeenCalled();
  });

  it("deve continuar a fila depois de uma recusa", async () => {
    // Uma baixa recusada não pode travar as seguintes: a recusa é dela, não da
    // conexão.
    listWriteOffsToSync.mockResolvedValue([pendingWriteOff("ref-1"), pendingWriteOff("ref-2")]);
    registerStockWriteOff
      .mockRejectedValueOnce(new ApiError("Produto excluído!"))
      .mockResolvedValue({ id: 901 });

    const outcome = await syncPendingWriteOffs();

    expect(outcome).toMatchObject({ sent: 1, rejected: 1 });
    expect(removePendingWriteOff).toHaveBeenCalledWith("ref-2");
  });

  it("deve parar na primeira falha de rede e manter o resto na fila", async () => {
    const first = pendingWriteOff("ref-1");
    listWriteOffsToSync.mockResolvedValue([first, pendingWriteOff("ref-2")]);
    registerStockWriteOff.mockRejectedValue(new TypeError("Failed to fetch"));
    tallyPendingWriteOffs.mockResolvedValue({ pending: 2, failed: 0 });

    const outcome = await syncPendingWriteOffs();

    // A rodada não lança: insistir nas seguintes só atrasaria o retorno.
    expect(outcome).toMatchObject({ sent: 0, rejected: 0, remaining: 2 });
    expect(markPendingWriteOffAttempted).toHaveBeenCalledWith(first);
    expect(registerStockWriteOff).toHaveBeenCalledTimes(1);
    expect(markPendingWriteOffFailed).not.toHaveBeenCalled();
  });

  it("deve parar num erro transiente do servidor sem marcar recusa nem devolver estoque", async () => {
    // Regressão: um 401 no meio da drenagem marcava as baixas como "Recusada"
    // e devolvia o saldo local — o PDV voltava a vender offline produto que já
    // tinha sido jogado fora.
    const first = pendingWriteOff("ref-1");
    listWriteOffsToSync.mockResolvedValue([first, pendingWriteOff("ref-2")]);
    registerStockWriteOff.mockRejectedValue(new ApiError("Unauthorized", 401));
    tallyPendingWriteOffs.mockResolvedValue({ pending: 2, failed: 0 });

    const outcome = await syncPendingWriteOffs();

    expect(outcome).toMatchObject({ sent: 0, rejected: 0, remaining: 2 });
    expect(markPendingWriteOffAttempted).toHaveBeenCalledWith(first);
    expect(registerStockWriteOff).toHaveBeenCalledTimes(1);
    expect(markPendingWriteOffFailed).not.toHaveBeenCalled();
    expect(restoreLocalStock).not.toHaveBeenCalled();
  });

  it("deve usar mensagem padrão quando a recusa vem sem texto", async () => {
    listWriteOffsToSync.mockResolvedValue([pendingWriteOff("ref-1")]);
    registerStockWriteOff.mockRejectedValue(new ApiError(""));

    await syncPendingWriteOffs();

    expect(markPendingWriteOffFailed).toHaveBeenCalledWith(
      expect.anything(),
      "O servidor recusou a baixa de estoque.",
    );
  });
});

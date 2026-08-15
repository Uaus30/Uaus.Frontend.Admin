import { beforeEach, describe, expect, it, vi } from "vitest";

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
const updatePdvSale = vi.fn();
const getPdvSessionSales = vi.fn();

/** Erro que o cliente HTTP lança quando o servidor **respondeu** recusando. */
class ApiError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

vi.mock("@workspace/api-client-react", () => ({
  ApiError,
  apiGet: (...args: unknown[]) => apiGet(...args),
  apiPost: (...args: unknown[]) => apiPost(...args),
  apiPut: (...args: unknown[]) => apiPut(...args),
  apiDelete: (...args: unknown[]) => apiDelete(...args),
  extractCreatedId: vi.fn(),
  cancelSale: vi.fn(),
  updatePdvSale: (...args: unknown[]) => updatePdvSale(...args),
  getPdvSessionSales: (...args: unknown[]) => getPdvSessionSales(...args),
}));

const checkLocalStock = vi.fn();
const consumeLocalStock = vi.fn();
const restoreLocalStock = vi.fn();
const savePendingSale = vi.fn();
const nextOfflineSaleNumber = vi.fn();

vi.mock("@/offline", () => ({
  checkLocalStock: (...args: unknown[]) => checkLocalStock(...args),
  consumeLocalStock: (...args: unknown[]) => consumeLocalStock(...args),
  restoreLocalStock: (...args: unknown[]) => restoreLocalStock(...args),
  savePendingSale: (...args: unknown[]) => savePendingSale(...args),
  nextOfflineSaleNumber: (...args: unknown[]) => nextOfflineSaleNumber(...args),
}));

const {
  computeSaleTotal,
  registerSale,
  restoreCancelledSaleStock,
  updateSale,
  getSessionSales,
  toLocalTimestamp,
  LocalStockError,
} = await import("./sales.service");

/** Carrinho de referência: 2 x R$ 10,00 + 1 x R$ 30,00. */
const ITEMS = [
  { productId: 1, quantity: 2, unitPrice: 10, productName: "Café" },
  { productId: 2, quantity: 1, unitPrice: 30, productName: "Caneta" },
];

/** Payload mínimo de uma venda do PDV. */
function payload(overrides: Record<string, unknown> = {}) {
  return {
    cashRegisterSessionId: 7,
    discount: 0,
    items: ITEMS,
    payments: [{ paymentMethodId: 1, amount: 50 }],
    ...overrides,
  };
}

/** Corpo enviado na chamada de número `index` do apiPost. */
function postBody(index: number) {
  return apiPost.mock.calls[index][1] as Record<string, any>;
}

/** Venda gravada na fila offline na chamada de número `index`. */
function queuedSale(index = 0) {
  return savePendingSale.mock.calls[index][0] as Record<string, any>;
}

describe("computeSaleTotal", () => {
  it("deve somar quantidade x preço de cada item", () => {
    expect(computeSaleTotal(ITEMS, 0)).toBe(50);
  });

  it("deve subtrair o desconto da venda", () => {
    expect(computeSaleTotal(ITEMS, 12.5)).toBe(37.5);
  });

  it("não deve devolver total negativo", () => {
    expect(computeSaleTotal(ITEMS, 999)).toBe(0);
  });

  it("deve arredondar para duas casas", () => {
    expect(computeSaleTotal([{ productId: 1, quantity: 3, unitPrice: 0.1 }], 0)).toBe(0.3);
  });

  it("deve devolver zero com o carrinho vazio", () => {
    expect(computeSaleTotal([], 0)).toBe(0);
  });
});

describe("toLocalTimestamp", () => {
  it("deve devolver o horário local sem indicador de fuso", () => {
    // Regressão: `toISOString()` devolve UTC, e o backend grava a hora recebida
    // como horário local — a venda das 17h34 entrava no painel como 20h34.
    const timestamp = toLocalTimestamp(new Date(2026, 6, 25, 17, 34, 12));

    expect(timestamp).toBe("2026-07-25T17:34:12");
    expect(timestamp).not.toMatch(/[Zz]|[+-]\d{2}:\d{2}$/);
  });

  it("deve preencher com zero à esquerda", () => {
    expect(toLocalTimestamp(new Date(2026, 0, 5, 9, 8, 7))).toBe("2026-01-05T09:08:07");
  });

  it("deve ser relido como o mesmo horário local", () => {
    // A fila offline e o cupom releem esta string com `new Date()`.
    const original = new Date(2026, 6, 25, 17, 34, 12);

    expect(new Date(toLocalTimestamp(original)).getHours()).toBe(original.getHours());
  });

  it("deve ordenar lexicograficamente na ordem cronológica", () => {
    // É como a fila offline ordena as vendas.
    const earlier = toLocalTimestamp(new Date(2026, 6, 25, 9, 0, 0));
    const later = toLocalTimestamp(new Date(2026, 6, 25, 17, 0, 0));

    expect(earlier.localeCompare(later)).toBeLessThan(0);
  });
});

describe("registerSale online", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiPost.mockResolvedValue({
      data: { id: 500, total: 50, createdAt: "2026-07-25T19:00:00", notes: null },
      response: {},
    });
    checkLocalStock.mockResolvedValue([]);
  });

  it("deve gravar a venda inteira em uma única requisição atômica", async () => {
    await registerSale(payload());

    // Antes eram 1 + N requisições, com desfazer manual quando um item falhava.
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(apiPost.mock.calls[0][0]).toBe("/Pdv/sales");
    // O desconto por item vai junto: não entra na validação de totais, mas o
    // servidor usa para auditoria e para o limite de desconto do vendedor.
    expect(postBody(0).items).toEqual([
      { productId: 1, quantity: 2, unitPrice: 10, discount: 0 },
      { productId: 2, quantity: 1, unitPrice: 30, discount: 0 },
    ]);
  });

  it("deve enviar o total calculado, o desconto e a sessão de caixa", async () => {
    await registerSale(payload({ discount: 5, payments: [{ paymentMethodId: 1, amount: 45 }] }));

    const body = postBody(0);
    expect(body.total).toBe(45);
    expect(body.discount).toBe(5);
    expect(body.cashRegisterSessionId).toBe(7);
  });

  it("deve enviar a chave de idempotência e o momento da venda", async () => {
    await registerSale(payload());

    const body = postBody(0);
    // Sem a referência, um reenvio por timeout duplicaria a venda no servidor.
    expect(body.clientReference).toBeTruthy();
    // Horário local sem fuso: o backend grava a hora que recebe como local.
    expect(body.occurredAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  it("deve normalizar as formas de pagamento com parcelas e taxa padrão", async () => {
    await registerSale(
      payload({
        payments: [
          { paymentMethodId: 1, amount: 20 },
          {
            paymentMethodId: 4,
            amount: 30,
            installments: 3,
            transactionFee: 1.84,
            paymentMethodInstallmentId: 5,
          },
        ],
      }),
    );

    expect(postBody(0).payments).toEqual([
      { paymentMethodId: 1, paymentMethodInstallmentId: null, amount: 20, installments: 1, transactionFee: 0 },
      { paymentMethodId: 4, paymentMethodInstallmentId: 5, amount: 30, installments: 3, transactionFee: 1.84 },
    ]);
  });

  it("deve limpar a observação em branco", async () => {
    await registerSale(payload({ notes: "   " }));

    expect(postBody(0).notes).toBeNull();
  });

  it("deve debitar o estoque local da venda gravada no servidor", async () => {
    await registerSale(payload());

    // A base local precisa acompanhar o balcão, senão a próxima venda offline
    // trabalharia com saldo antigo.
    expect(consumeLocalStock).toHaveBeenCalledWith([
      { productId: 1, quantity: 2 },
      { productId: 2, quantity: 1 },
    ]);
  });

  it("deve devolver o número definitivo do cupom", async () => {
    const saved = await registerSale(payload());

    expect(saved).toMatchObject({ id: 500, receiptNumber: 500, offline: false });
  });

  it("deve propagar a recusa do servidor sem enfileirar a venda", async () => {
    apiPost.mockRejectedValue(new ApiError("Estoque insuficiente para o produto informado!"));

    await expect(registerSale(payload())).rejects.toThrow("Estoque insuficiente");

    // O servidor respondeu "não": enfileirar só adiaria o mesmo "não".
    expect(savePendingSale).not.toHaveBeenCalled();
  });

  it("deve enfileirar a venda quando a conexão cai no meio da requisição", async () => {
    apiPost.mockRejectedValue(new TypeError("Failed to fetch"));
    nextOfflineSaleNumber.mockResolvedValue(3);

    const saved = await registerSale(payload());

    // Entre perder a venda e guardá-la para sincronizar, guardar é sempre melhor.
    expect(saved).toMatchObject({ id: null, receiptNumber: "OFF-3", offline: true });
    expect(savePendingSale).toHaveBeenCalledTimes(1);
  });

  it("deve reutilizar a chave de idempotência informada em todas as tentativas", async () => {
    // Regressão: a chave era gerada a cada chamada, então a retentativa manual
    // do operador (após um 504 do proxy com a venda já gravada) subia com chave
    // NOVA e o servidor gravava uma segunda venda idêntica — o índice único de
    // ClientReference não tinha como barrar.
    apiPost.mockRejectedValueOnce(new ApiError("Gateway Timeout", 504));

    await expect(
      registerSale(payload(), { clientReference: "chave-do-checkout" }),
    ).rejects.toThrow("Gateway Timeout");
    await registerSale(payload(), { clientReference: "chave-do-checkout" });

    expect(postBody(0).clientReference).toBe("chave-do-checkout");
    expect(postBody(1).clientReference).toBe("chave-do-checkout");
  });

  it("deve recusar desconto negativo antes de qualquer gravação", async () => {
    // Desconto negativo AUMENTA o total: "-5" numa venda de R$ 50 cobraria
    // R$ 55. Online o servidor recusa; offline a fila só descobriria horas
    // depois, na sincronização.
    await expect(registerSale(payload({ discount: -5 }))).rejects.toThrow(
      "não pode ser negativo",
    );

    expect(apiPost).not.toHaveBeenCalled();
    expect(savePendingSale).not.toHaveBeenCalled();
  });
});

describe("registerSale offline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkLocalStock.mockResolvedValue([]);
    nextOfflineSaleNumber.mockResolvedValue(1);
  });

  it("não deve tocar a rede", async () => {
    await registerSale(payload(), { offline: true });

    expect(apiPost).not.toHaveBeenCalled();
  });

  it("deve gravar a venda na fila com o número provisório", async () => {
    nextOfflineSaleNumber.mockResolvedValue(14);

    const saved = await registerSale(payload(), { offline: true });

    expect(saved).toMatchObject({ id: null, receiptNumber: "OFF-14", offline: true, total: 50 });
    expect(queuedSale()).toMatchObject({ offlineNumber: 14, status: "pending", attempts: 0 });
  });

  it("deve guardar na fila o nome dos produtos e das formas de pagamento", async () => {
    await registerSale(
      payload({
        payments: [{ paymentMethodId: 1, amount: 50, paymentMethodName: "Dinheiro" }],
      }),
      { offline: true },
    );

    // O cupom e a lista de pendências precisam desses nomes, e a base local pode
    // ter mudado quando a venda subir.
    expect(queuedSale().items[0].productName).toBe("Café");
    expect(queuedSale().payments[0].paymentMethodName).toBe("Dinheiro");
  });

  it("deve gravar a venda antes de debitar o estoque", async () => {
    await registerSale(payload(), { offline: true });

    // Ordem inversa deixaria o estoque debitado por uma venda que não existe.
    const saveOrder = savePendingSale.mock.invocationCallOrder[0];
    const consumeOrder = consumeLocalStock.mock.invocationCallOrder[0];
    expect(saveOrder).toBeLessThan(consumeOrder);
  });

  it("deve recusar a venda que não cabe no estoque local", async () => {
    checkLocalStock.mockResolvedValue([
      { productId: 1, productName: "Café", requested: 2, available: 1 },
    ]);

    await expect(registerSale(payload(), { offline: true })).rejects.toBeInstanceOf(LocalStockError);

    // Nada é gravado: a mesma regra vale no servidor, e deixar passar só adiaria
    // a recusa para a sincronização.
    expect(savePendingSale).not.toHaveBeenCalled();
    expect(consumeLocalStock).not.toHaveBeenCalled();
  });

  it("deve informar no erro qual produto faltou", async () => {
    checkLocalStock.mockResolvedValue([
      { productId: 1, productName: "Café", requested: 5, available: 2 },
    ]);

    await expect(registerSale(payload(), { offline: true })).rejects.toThrow(/Café.*5.*2/);
  });

  it("deve gerar uma referência diferente para cada venda", async () => {
    await registerSale(payload(), { offline: true });
    await registerSale(payload(), { offline: true });

    expect(queuedSale(0).clientReference).not.toBe(queuedSale(1).clientReference);
  });

  it("deve enfileirar com a chave do checkout quando ela é informada", async () => {
    // A mesma garantia do caminho online: a fila é idempotente pela chave, e a
    // chave é da venda, não da tentativa.
    await registerSale(payload(), { offline: true, clientReference: "chave-do-checkout" });

    expect(queuedSale().clientReference).toBe("chave-do-checkout");
  });

  it("deve recusar desconto negativo também offline", async () => {
    await expect(registerSale(payload({ discount: -1 }), { offline: true })).rejects.toThrow(
      "não pode ser negativo",
    );

    expect(savePendingSale).not.toHaveBeenCalled();
    expect(consumeLocalStock).not.toHaveBeenCalled();
  });
});

describe("restoreCancelledSaleStock", () => {
  it("deve devolver à base local o estoque dos itens da venda cancelada", async () => {
    // Regressão: o cancelamento devolvia o estoque só no servidor; a projeção
    // local ficava subestimada até o próximo snapshot e o PDV recusava venda
    // offline de produto que estava na prateleira.
    vi.clearAllMocks();
    apiGet.mockResolvedValue({
      items: [
        { id: 900, productId: 1, quantity: 4 },
        { id: 901, productId: 2, quantity: 1 },
      ],
    });

    await restoreCancelledSaleStock(500);

    expect(apiGet).toHaveBeenCalledWith("/SaleItems", { saleId: 500, page: 1, size: 200 });
    expect(restoreLocalStock).toHaveBeenCalledWith([
      { productId: 1, quantity: 4 },
      { productId: 2, quantity: 1 },
    ]);
  });
});

describe("updateSale", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updatePdvSale.mockResolvedValue({ id: 500, total: 50 });
    apiGet.mockResolvedValue({ id: 500, notes: "Venda anterior" });
  });

  it("deve regravar a venda inteira em uma única requisição atômica", async () => {
    // Antes era PUT no cabeçalho + N DELETE/POST de itens, sem transação: uma
    // falha no meio deixava a venda pela metade. Agora o servidor devolve o
    // estoque dos itens antigos e consome o dos novos em uma transação só.
    await updateSale(500, payload());

    expect(updatePdvSale).toHaveBeenCalledTimes(1);
    expect(updatePdvSale.mock.calls[0][0]).toBe(500);
    expect(apiDelete).not.toHaveBeenCalled();
    expect(updatePdvSale.mock.calls[0][1]).toMatchObject({
      total: 50,
      items: [
        { productId: 1, quantity: 2, unitPrice: 10, discount: 0 },
        { productId: 2, quantity: 1, unitPrice: 30, discount: 0 },
      ],
    });
  });

  it("deve manter a observação atual quando nenhuma é informada", async () => {
    // Regressão: `PUT /Pdv/sales/{id}` regrava a venda inteira e a tela de
    // reedição não reenvia a observação, então mandar `null` apagava a
    // observação da venda a cada edição.
    await updateSale(500, payload());

    expect((updatePdvSale.mock.calls[0][1] as Record<string, unknown>).notes).toBe("Venda anterior");
  });

  it("deve gravar a observação informada sem reler a venda", async () => {
    await updateSale(500, payload({ notes: "  Troca de tamanho  " }));

    expect((updatePdvSale.mock.calls[0][1] as Record<string, unknown>).notes).toBe("Troca de tamanho");
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe("getSessionSales", () => {
  it("deve filtrar as vendas pela sessão de caixa", async () => {
    vi.clearAllMocks();
    getPdvSessionSales.mockResolvedValue([{ id: 1 }]);

    const sales = await getSessionSales(7);

    expect(getPdvSessionSales).toHaveBeenCalledWith(7);
    expect(sales).toEqual([{ id: 1 }]);
  });
});

describe("venda sem controle de caixa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiPost.mockResolvedValue({
      data: { id: 500, total: 50, createdAt: "2026-07-25T19:00:00", notes: null },
      response: {},
    });
    checkLocalStock.mockResolvedValue([]);
    nextOfflineSaleNumber.mockResolvedValue(1);
  });

  it("deve enviar sessão nula quando a loja não controla caixa", async () => {
    // Quem resolve a sessão é o servidor: PdvService.ResolveSaleSessionAsync
    // devolve nulo nesse modo e ignora o que o PDV mandar.
    await registerSale(payload({ cashRegisterSessionId: null }));

    expect(postBody(0).cashRegisterSessionId).toBeNull();
  });

  it("deve guardar sessão nula na fila offline", async () => {
    // A fila precisa aceitar venda sem turno; senão o modo sem caixa funcionaria
    // online e falharia justamente quando a internet cai.
    await registerSale(payload({ cashRegisterSessionId: null }), { offline: true });

    expect(queuedSale().cashRegisterSessionId).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const getStockWriteOff = vi.fn();
const registerStockWriteOff = vi.fn();
const reverseStockWriteOff = vi.fn();

// Os enums são copiados do contrato em packages/api-client: o service os usa em
// tempo de import (rótulos e opções dos selects).
vi.mock("@workspace/api-client-react", () => ({
  getStockWriteOff: (...args: unknown[]) => getStockWriteOff(...args),
  registerStockWriteOff: (...args: unknown[]) => registerStockWriteOff(...args),
  reverseStockWriteOff: (...args: unknown[]) => reverseStockWriteOff(...args),
  SELECTABLE_STOCK_WRITE_OFF_REASONS: [1, 2, 3],
  STOCK_WRITE_OFF_REASON_LABEL: {
    1: "Consumo",
    2: "Perda",
    3: "Doação",
    4: "Inventário",
  },
  STOCK_WRITE_OFF_STATUS: { None: 0, Confirmed: 1, Reversed: 2 },
}));

const {
  ALL_FILTER_VALUE,
  EMPTY_STOCK_WRITE_OFF_FILTERS,
  SELECTABLE_STOCK_WRITE_OFF_REASON_OPTIONS,
  STOCK_WRITE_OFF_REASON_FILTER_OPTIONS,
  STOCK_WRITE_OFF_STATUS_OPTIONS,
  buildRegisterStockWriteOffPayload,
  buildStockWriteOffQuery,
  isSelectableWriteOffReason,
  submitStockWriteOff,
  submitStockWriteOffReversal,
} = await import("../stock-write-offs.service");

/** Linha de rascunho mínima, só com o que o payload realmente usa. */
function draftItem(productId: number, quantity: number) {
  return { productId, quantity, productName: `Produto ${productId}`, barcode: null, stock: 100 };
}

describe("buildStockWriteOffQuery", () => {
  it("deve omitir os filtros em 'all' e as datas em branco", () => {
    const query = buildStockWriteOffQuery(EMPTY_STOCK_WRITE_OFF_FILTERS, { page: 1, limit: 15 });

    expect(query).toEqual({
      reason: undefined,
      status: undefined,
      startDate: undefined,
      endDate: undefined,
      userId: undefined,
      page: 1,
      limit: 15,
    });
  });

  it("deve converter os selects para código numérico e repassar o período", () => {
    const query = buildStockWriteOffQuery(
      {
        reason: "2",
        status: "1",
        startDate: "2026-07-01",
        endDate: "2026-07-31",
        userId: "7",
      },
      { page: 3, limit: 15 },
    );

    expect(query).toEqual({
      reason: 2,
      status: 1,
      startDate: "2026-07-01",
      endDate: "2026-07-31",
      userId: 7,
      page: 3,
      limit: 15,
    });
  });

  it("deve descartar valor de filtro que não é número", () => {
    const query = buildStockWriteOffQuery(
      { ...EMPTY_STOCK_WRITE_OFF_FILTERS, reason: "perda" },
      { page: 1, limit: 15 },
    );

    expect(query.reason).toBeUndefined();
  });
});

describe("opções dos selects", () => {
  it("deve oferecer Inventário no filtro, porque ele existe no histórico", () => {
    expect(STOCK_WRITE_OFF_REASON_FILTER_OPTIONS).toContainEqual({ value: "4", label: "Inventário" });
  });

  it("não deve oferecer Inventário ao registrar uma baixa", () => {
    expect(SELECTABLE_STOCK_WRITE_OFF_REASON_OPTIONS.map((option) => option.label)).toEqual([
      "Consumo",
      "Perda",
      "Doação",
    ]);
  });

  it("deve rotular as situações", () => {
    expect(STOCK_WRITE_OFF_STATUS_OPTIONS).toEqual([
      { value: "1", label: "Efetivada" },
      { value: "2", label: "Estornada" },
    ]);
  });

  it("deve reconhecer somente os motivos escolhíveis", () => {
    expect(isSelectableWriteOffReason(2)).toBe(true);
    expect(isSelectableWriteOffReason(4)).toBe(false);
    expect(isSelectableWriteOffReason(0)).toBe(false);
  });

  it("deve começar com todos os filtros neutros", () => {
    expect(EMPTY_STOCK_WRITE_OFF_FILTERS.reason).toBe(ALL_FILTER_VALUE);
    expect(EMPTY_STOCK_WRITE_OFF_FILTERS.startDate).toBe("");
  });
});

describe("buildRegisterStockWriteOffPayload", () => {
  it("deve reduzir cada item a produto e quantidade", () => {
    const payload = buildRegisterStockWriteOffPayload({
      reason: 2,
      items: [draftItem(5, 3), draftItem(9, 1)],
      notes: "Caiu no chão",
    });

    expect(payload).toEqual({
      reason: 2,
      items: [
        { productId: 5, quantity: 3 },
        { productId: 9, quantity: 1 },
      ],
      notes: "Caiu no chão",
    });
  });

  it("deve somar linhas repetidas do mesmo produto", () => {
    const payload = buildRegisterStockWriteOffPayload({
      reason: 1,
      items: [draftItem(5, 2), draftItem(9, 1), draftItem(5, 4)],
    });

    expect(payload.items).toEqual([
      { productId: 5, quantity: 6 },
      { productId: 9, quantity: 1 },
    ]);
  });

  it("deve descartar quantidade zerada, negativa ou inválida", () => {
    const payload = buildRegisterStockWriteOffPayload({
      reason: 1,
      items: [draftItem(1, 0), draftItem(2, -3), draftItem(3, Number.NaN), draftItem(4, 2)],
    });

    expect(payload.items).toEqual([{ productId: 4, quantity: 2 }]);
  });

  it("deve enviar null quando a observação está em branco", () => {
    expect(buildRegisterStockWriteOffPayload({ reason: 1, items: [], notes: "   " }).notes).toBeNull();
    expect(buildRegisterStockWriteOffPayload({ reason: 1, items: [] }).notes).toBeNull();
  });
});

describe("submitStockWriteOff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registerStockWriteOff.mockResolvedValue({ id: 42 });
  });

  it("deve postar o payload montado a partir do rascunho", async () => {
    await submitStockWriteOff({ reason: 3, items: [draftItem(7, 2)], notes: "Doação" });

    expect(registerStockWriteOff).toHaveBeenCalledWith({
      reason: 3,
      items: [{ productId: 7, quantity: 2 }],
      notes: "Doação",
    });
  });

  it("deve recusar o motivo Inventário sem chamar a API", async () => {
    await expect(submitStockWriteOff({ reason: 4, items: [draftItem(7, 2)] })).rejects.toThrow(
      "Selecione o motivo da baixa.",
    );
    expect(registerStockWriteOff).not.toHaveBeenCalled();
  });

  it("deve recusar rascunho sem motivo escolhido", async () => {
    await expect(submitStockWriteOff({ reason: 0, items: [draftItem(7, 2)] })).rejects.toThrow(
      "Selecione o motivo da baixa.",
    );
  });

  it("deve recusar rascunho sem item com quantidade positiva", async () => {
    await expect(submitStockWriteOff({ reason: 2, items: [draftItem(7, 0)] })).rejects.toThrow(
      "Adicione ao menos um produto com quantidade maior que zero.",
    );
    expect(registerStockWriteOff).not.toHaveBeenCalled();
  });
});

describe("submitStockWriteOffReversal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reverseStockWriteOff.mockResolvedValue({ id: 42 });
  });

  it("deve enviar o motivo sem espaços sobrando", async () => {
    await submitStockWriteOffReversal(42, "  Lançado em duplicidade  ");

    expect(reverseStockWriteOff).toHaveBeenCalledWith(42, "Lançado em duplicidade");
  });

  it("deve exigir o motivo do estorno", async () => {
    await expect(submitStockWriteOffReversal(42, "   ")).rejects.toThrow(
      "Informe o motivo do estorno.",
    );
    expect(reverseStockWriteOff).not.toHaveBeenCalled();
  });
});

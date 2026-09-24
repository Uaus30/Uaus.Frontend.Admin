import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SavePurchasePayload, SupplierDto } from "@workspace/api-client-react";
import { toDateKey } from "@workspace/core";
import {
  applyPurchaseDefaults,
  purchaseDefaultsFromPayload,
  readPurchaseDefaults,
  rememberPurchaseDefaults,
  type PurchaseDefaults,
} from "../purchase-memory";
import { emptyPurchaseForm } from "../../hooks/usePurchaseForm";

const LEMBRADO: PurchaseDefaults = {
  supplierId: "13",
  purchaseDate: "2026-09-20",
  status: "2",
  invoiceNumber: "NF 4521",
};

const FORNECEDORES = [{ id: 13, name: "Shopee" }] as unknown as SupplierDto[];

describe("memória da última compra", () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(() => vi.restoreAllMocks());

  it("sem nada gravado, não há memória — o formulário nasce com o padrão", () => {
    expect(readPurchaseDefaults(7)).toBeNull();
  });

  it("devolve o que a última compra registrada usou", () => {
    rememberPurchaseDefaults(7, LEMBRADO);
    expect(readPurchaseDefaults(7)).toEqual(LEMBRADO);
  });

  it("é por usuário: a compra de um funcionário não preenche a do outro", () => {
    rememberPurchaseDefaults(7, LEMBRADO);
    expect(readPurchaseDefaults(8)).toBeNull();
  });

  it("nota apagada também é lembrada: o novo padrão passa a ser sem nota", () => {
    rememberPurchaseDefaults(7, LEMBRADO);
    rememberPurchaseDefaults(7, { ...LEMBRADO, invoiceNumber: "" });
    expect(readPurchaseDefaults(7)?.invoiceNumber).toBe("");
  });

  it("texto que não é JSON não derruba a modal", () => {
    window.localStorage.setItem("uaus-admin:compras:ultimo-preenchimento:7", "{quebrado");
    expect(readPurchaseDefaults(7)).toBeNull();
  });

  it("campo que não serve volta ao padrão dele, e o resto continua valendo", () => {
    window.localStorage.setItem(
      "uaus-admin:compras:ultimo-preenchimento:7",
      JSON.stringify({ supplierId: "abc", purchaseDate: "2999-01-01", status: "3", invoiceNumber: 42 }),
    );
    // Data no futuro só com o relógio da máquina mexido: compra nunca é adiantada.
    // E "Lançado" (3) nunca é escolhido à mão.
    expect(readPurchaseDefaults(7)).toEqual({
      supplierId: "",
      purchaseDate: toDateKey(new Date()),
      status: "1",
      invoiceNumber: "",
    });
  });

  it("armazenamento cheio ou bloqueado não transforma o salvar em erro", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => rememberPurchaseDefaults(7, LEMBRADO)).not.toThrow();
  });

  it("lembra o que o servidor ACEITOU, a partir do corpo gravado", () => {
    const payload = {
      supplierId: 13,
      purchaseDate: "2026-09-20T00:00:00",
      status: 2,
      invoiceNumber: null,
    } as SavePurchasePayload;

    expect(purchaseDefaultsFromPayload(payload)).toEqual({
      supplierId: "13",
      purchaseDate: "2026-09-20",
      status: "2",
      invoiceNumber: "",
    });
  });

  it("aplica fornecedor, data, situação e nota no formulário em branco", () => {
    const form = applyPurchaseDefaults(emptyPurchaseForm(), LEMBRADO, FORNECEDORES);
    expect(form).toMatchObject({
      supplierId: "13",
      purchaseDate: "2026-09-20",
      status: "2",
      invoiceNumber: "NF 4521",
    });
    // O resto continua o de uma compra nova.
    expect(form.productName).toBe("");
    expect(form.grossTotal).toBe(0);
  });

  it("fornecedor que saiu do catálogo não é aplicado; o resto é", () => {
    const outros = [{ id: 2, name: "Max" }] as unknown as SupplierDto[];
    const form = applyPurchaseDefaults(emptyPurchaseForm(), LEMBRADO, outros);
    expect(form.supplierId).toBe("");
    expect(form.invoiceNumber).toBe("NF 4521");
  });

  it("com o catálogo ainda carregando, o fornecedor entra e o nome aparece depois", () => {
    expect(applyPurchaseDefaults(emptyPurchaseForm(), LEMBRADO, []).supplierId).toBe("13");
  });
});

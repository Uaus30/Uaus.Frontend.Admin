import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupplierDto } from "@workspace/api-client-react";
import {
  SUPPLIER_FILTER_ALL,
  effectiveSupplierFilter,
  purchasesSupplierParams,
  readSupplierFilter,
  rememberSupplierFilter,
} from "../purchase-filters";

const FORNECEDORES = [
  { id: 13, name: "Shopee" },
  { id: 4, name: "Atacado" },
] as unknown as SupplierDto[];

describe("filtro de fornecedor lembrado", () => {
  beforeEach(() => window.localStorage.clear());

  afterEach(() => vi.restoreAllMocks());

  it("sem nada gravado, mostra todos os fornecedores", () => {
    expect(readSupplierFilter(7)).toBe(SUPPLIER_FILTER_ALL);
  });

  it("devolve o fornecedor filtrado da última vez — inclusive depois de a tela ser desmontada", () => {
    rememberSupplierFilter(7, "13");
    expect(readSupplierFilter(7)).toBe("13");
  });

  it("é por usuário: o filtro de um funcionário não esconde as compras do outro", () => {
    rememberSupplierFilter(7, "13");
    expect(readSupplierFilter(8)).toBe(SUPPLIER_FILTER_ALL);
  });

  it("voltar para todos apaga a memória", () => {
    rememberSupplierFilter(7, "13");
    rememberSupplierFilter(7, SUPPLIER_FILTER_ALL);
    expect(window.localStorage.length).toBe(0);
    expect(readSupplierFilter(7)).toBe(SUPPLIER_FILTER_ALL);
  });

  it("valor que não é id volta a todos em vez de derrubar a tela", () => {
    window.localStorage.setItem("uaus-admin:compras:filtro-fornecedor:7", "Shopee");
    expect(readSupplierFilter(7)).toBe(SUPPLIER_FILTER_ALL);
  });

  it("navegador sem armazenamento não quebra nem a leitura nem a gravação", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    expect(() => rememberSupplierFilter(7, "13")).not.toThrow();
    expect(readSupplierFilter(7)).toBe(SUPPLIER_FILTER_ALL);
  });
});

describe("effectiveSupplierFilter", () => {
  it("fornecedor excluído do catálogo deixa de filtrar", () => {
    expect(effectiveSupplierFilter("99", FORNECEDORES)).toBe(SUPPLIER_FILTER_ALL);
  });

  it("fornecedor que existe continua filtrando", () => {
    expect(effectiveSupplierFilter("13", FORNECEDORES)).toBe("13");
  });

  it("com o catálogo ainda carregando, vale o lembrado", () => {
    expect(effectiveSupplierFilter("99", [])).toBe("99");
  });
});

describe("purchasesSupplierParams", () => {
  it("todos não manda parâmetro; um fornecedor manda o id", () => {
    expect(purchasesSupplierParams(SUPPLIER_FILTER_ALL)).toEqual({});
    expect(purchasesSupplierParams("13")).toEqual({ supplierId: 13 });
  });
});

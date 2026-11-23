import { afterEach, describe, expect, it, vi } from "vitest";
import type { CapitalContributionDto, PurchaseBudgetDto } from "../models";
import {
  createCapitalContribution,
  deleteCapitalContribution,
  getGetCapitalContributionTotalsByPartnerQueryKey,
  getGetCapitalContributionsQueryKey,
  updateCapitalContribution,
} from "./capital-contributions";
import { getGetFinancialClosingNextQueryKey, getGetFinancialClosingsQueryKey } from "./financial-closings";
import { getGetPurchaseBudgetQueryKey, getPurchaseBudget } from "./purchase-budget";

/**
 * Rotas e chaves do financeiro novo (PLANO-FINANCEIRO.md, seção 6.1). O backend
 * é escrito em paralelo contra o mesmo contrato: o que estes testes travam é o
 * lado de cá — o caminho, o verbo, o corpo e as chaves que as telas invalidam.
 */

const aporte: CapitalContributionDto = {
  id: 7,
  partnerId: 1,
  partnerName: "Wagner",
  contributionDate: "2026-11-23T00:00:00",
  amount: 500,
  createdAt: "2026-11-23T10:00:00",
  createdBy: "Wagner",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("aportes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lança pelo POST com a data de calendário como veio", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(aporte, 201));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createCapitalContribution({
      partnerId: 1,
      contributionDate: "2026-11-23",
      amount: 500,
      notes: null,
    });

    expect(result).toEqual(aporte);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.uaus.com.br/CapitalContributions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      partnerId: 1,
      contributionDate: "2026-11-23",
      amount: 500,
      notes: null,
    });
  });

  it("altera pelo PUT e exclui pelo DELETE, no id", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(aporte))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await updateCapitalContribution(7, { partnerId: 1, contributionDate: "2026-11-22", amount: 600 });
    await deleteCapitalContribution(7);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.uaus.com.br/CapitalContributions/7",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.uaus.com.br/CapitalContributions/7",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

describe("faixa de compras", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("consulta o mês pedido em yyyy-MM, e sem mês deixa o servidor escolher o corrente", async () => {
    const budget = { month: "2026-11", band: "Green" } as PurchaseBudgetDto;
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(budget)));
    vi.stubGlobal("fetch", fetchMock);

    await expect(getPurchaseBudget({ month: "2026-11" })).resolves.toEqual(budget);
    await getPurchaseBudget();

    expect(fetchMock.mock.calls[0][0]).toBe("https://api.uaus.com.br/PurchaseBudget?month=2026-11");
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.uaus.com.br/PurchaseBudget");
  });
});

describe("chaves de cache do contrato", () => {
  it("são as do plano, e o next fica debaixo do prefixo dos fechamentos", () => {
    expect(getGetCapitalContributionsQueryKey()).toEqual(["CapitalContributions"]);
    expect(getGetPurchaseBudgetQueryKey()).toEqual(["PurchaseBudget"]);
    expect(getGetFinancialClosingNextQueryKey()).toEqual(["FinancialClosings", "next"]);
    // Invalidar os fechamentos tem que alcançar o `next`, e invalidar os aportes,
    // o acumulado por sócio — por isso os dois são extensões do prefixo.
    expect(getGetFinancialClosingNextQueryKey().slice(0, 1)).toEqual(getGetFinancialClosingsQueryKey());
    expect(getGetCapitalContributionTotalsByPartnerQueryKey().slice(0, 1)).toEqual(
      getGetCapitalContributionsQueryKey(),
    );
  });
});

import React from "react";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignReportDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetCampaignReport: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado. As chaves de cache vêm do módulo REAL:
// redefini-las aqui já mascarou uma quebra de invalidação em outra feature,
// porque o teste passava contra a chave inventada no mock.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCampaignReport: mocks.useGetCampaignReport,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { buildReportCards, describeReportWindow, useCampaignReport } = await import("../useCampaignReport");

/** Relatório de referência: os números do exemplo do contrato. */
const report: CampaignReportDto = {
  campaignId: 3,
  campaignName: "Setembro 2026",
  startsAt: "2026-09-01T00:00:00",
  endsAt: "2026-09-30T23:59:59",
  redemptions: 143,
  reversed: 4,
  overLimit: 0,
  definitionDrift: 0,
  campaign: {
    salesCount: 143,
    revenue: 18420.5,
    profit: 5210.1,
    couponDiscount: 1842.05,
    averageTicket: 128.81,
    marginPercentage: 28.3,
  },
  period: {
    salesCount: 980,
    revenue: 121300,
    profit: 38900,
    averageTicket: 123.77,
    marginPercentage: 32.1,
  },
  share: { salesPercentage: 14.6, revenuePercentage: 15.2, profitPercentage: 13.4 },
  daily: [
    { day: "2026-09-01T00:00:00", redemptions: 12, campaignRevenue: 1520, periodRevenue: 9800 },
    { day: "2026-09-02T00:00:00", redemptions: 0, campaignRevenue: 0, periodRevenue: 8300 },
  ],
  coupons: [
    { couponId: 12, code: "10OFFSET26", redemptions: 143, revenue: 18420.5, couponDiscount: 1842.05 },
  ],
  questions: [
    {
      questionId: 7,
      label: "Como conheceu a loja?",
      answered: 140,
      options: [
        {
          optionId: 21,
          label: "Instagram",
          count: 96,
          percentage: 68.57,
          revenue: 12800,
          averageTicket: 133.33,
        },
      ],
    },
  ],
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Atalho para achar um card pelo `key` sem depender da ordem da lista. */
const card = (cards: ReturnType<typeof buildReportCards>, key: string) =>
  cards.find((item) => item.key === key)!;

describe("useCampaignReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useGetCampaignReport.mockReturnValue({
      data: report,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("deve consultar o relatório da campanha informada", () => {
    renderHook(() => useCampaignReport(3), { wrapper: createWrapper() });

    expect(mocks.useGetCampaignReport).toHaveBeenCalledWith(3);
  });

  it("deve manter a query desligada quando o id não veio da rota", () => {
    // Com id indefinido a query fica `enabled: false` e nunca entrega dado —
    // é assim que `useGetCampaignReport` se comporta de verdade.
    mocks.useGetCampaignReport.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCampaignReport(undefined), { wrapper: createWrapper() });

    expect(mocks.useGetCampaignReport).toHaveBeenCalledWith(undefined);
    expect(result.current.cards).toEqual([]);
    expect(result.current.windowLabel).toBe("");
    expect(result.current.daily).toEqual([]);
    expect(result.current.questions).toEqual([]);
  });

  it("deve montar cada card de dinheiro com o denominador da loja e a participação", () => {
    const { result } = renderHook(() => useCampaignReport(3), { wrapper: createWrapper() });

    const faturamento = card(result.current.cards, "revenue");
    expect(faturamento.campaignValue).toBe(18420.5);
    expect(faturamento.periodValue).toBe(121300);
    expect(faturamento.sharePercentage).toBe(15.2);
    expect(faturamento.kind).toBe("money");

    const lucro = card(result.current.cards, "profit");
    expect(lucro.periodValue).toBe(38900);
    expect(lucro.sharePercentage).toBe(13.4);
  });

  it("deve comparar resgates com as VENDAS da loja, que é o denominador que existe", () => {
    const { result } = renderHook(() => useCampaignReport(3), { wrapper: createWrapper() });

    const resgates = card(result.current.cards, "redemptions");
    expect(resgates.kind).toBe("count");
    expect(resgates.campaignValue).toBe(143);
    expect(resgates.periodValue).toBe(980);
    expect(resgates.sharePercentage).toBe(14.6);
  });

  it("não deve inventar denominador para estorno nem para o custo em cupons", () => {
    const { result } = renderHook(() => useCampaignReport(3), { wrapper: createWrapper() });

    const estornos = card(result.current.cards, "reversed");
    expect(estornos.campaignValue).toBe(4);
    expect(estornos.periodValue).toBeNull();
    expect(estornos.sharePercentage).toBeNull();

    const custo = card(result.current.cards, "couponDiscount");
    expect(custo.periodValue).toBeNull();
    expect(custo.sharePercentage).toBeNull();
  });

  it("não deve tratar a razão entre ticket médios como participação", () => {
    const { result } = renderHook(() => useCampaignReport(3), { wrapper: createWrapper() });

    const ticket = card(result.current.cards, "averageTicket");
    expect(ticket.campaignValue).toBe(128.81);
    expect(ticket.periodValue).toBe(123.77);
    expect(ticket.sharePercentage).toBeNull();
  });

  it("deve expressar o custo em cupons como percentual do faturamento da campanha", () => {
    const cards = buildReportCards(report);

    // 1842,05 / 18420,50 = 10%.
    expect(card(cards, "couponDiscount").note).toBe("10,00% do faturamento da campanha");
  });

  it("não deve devolver NaN no custo quando a campanha não faturou nada", () => {
    const zerada: CampaignReportDto = {
      ...report,
      campaign: { ...report.campaign, revenue: 0, couponDiscount: 0 },
    };

    expect(card(buildReportCards(zerada), "couponDiscount").note).toBe("0,00% do faturamento da campanha");
  });

  it("deve destacar resgates acima do limite e definição divergente na nota do estorno", () => {
    const comAviso: CampaignReportDto = { ...report, overLimit: 3, definitionDrift: 2 };

    expect(card(buildReportCards(comAviso), "reversed").note).toBe(
      "3 acima do limite do cupom · 2 com definição divergente",
    );
  });

  it("deve avisar que a campanha em aberto é medida até agora", () => {
    // O backend OMITE o campo nulo (WhenWritingNull) — o DTO chega sem `endsAt`.
    expect(describeReportWindow("2026-09-01T00:00:00")).toBe(
      "01/09/2026, 00:00 até agora (campanha em aberto)",
    );
    expect(describeReportWindow("2026-09-01T00:00:00", "2026-09-30T23:59:59")).toBe(
      "01/09/2026, 00:00 até 30/09/2026, 23:59",
    );
  });

  it("deve reconhecer movimento na série diária e negá-lo quando tudo é zero", () => {
    const { result } = renderHook(() => useCampaignReport(3), { wrapper: createWrapper() });
    expect(result.current.hasDailyMovement).toBe(true);
    expect(result.current.daily).toHaveLength(2);

    mocks.useGetCampaignReport.mockReturnValue({
      data: {
        ...report,
        daily: [{ day: "2026-09-01T00:00:00", redemptions: 0, campaignRevenue: 0, periodRevenue: 0 }],
      },
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const semMovimento = renderHook(() => useCampaignReport(3), { wrapper: createWrapper() });
    expect(semMovimento.result.current.hasDailyMovement).toBe(false);
  });

  it("deve avisar quando o servidor falhou, e só quando o erro é do servidor", () => {
    mocks.useGetCampaignReport.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: { status: 500, message: "Erro interno" },
      refetch: vi.fn(),
    });

    renderHook(() => useCampaignReport(3), { wrapper: createWrapper() });

    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Servidor indisponível" }));
  });

  it("não deve avisar servidor indisponível quando a campanha não existe (404)", () => {
    mocks.useGetCampaignReport.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: { status: 404, message: "Campanha não encontrada!" },
      refetch: vi.fn(),
    });

    renderHook(() => useCampaignReport(3), { wrapper: createWrapper() });

    expect(mocks.toast).not.toHaveBeenCalled();
  });
});

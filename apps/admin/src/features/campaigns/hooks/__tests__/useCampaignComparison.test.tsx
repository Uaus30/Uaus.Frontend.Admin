import React from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CampaignComparisonRowDto, CampaignDto } from "@workspace/api-client-react";

const mocks = vi.hoisted(() => ({
  useGetCampaigns: vi.fn(),
  useGetCampaignComparison: vi.fn(),
  toast: vi.fn(),
}));

// Só o que fala com a rede é dublado. `MAX_COMPARISON_CAMPAIGNS` e as chaves de
// cache vêm do módulo REAL: um teto redefinido no mock testaria o número
// inventado aqui, e não o que o servidor recusa com 400.
vi.mock("@workspace/api-client-react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/api-client-react")>()),
  useGetCampaigns: mocks.useGetCampaigns,
  useGetCampaignComparison: mocks.useGetCampaignComparison,
}));

vi.mock("@workspace/ui", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@workspace/ui")>()),
  useToast: () => ({ toast: mocks.toast }),
}));

const { MAX_COMPARISON_CAMPAIGNS } = await import("@workspace/api-client-react");
const { buildComparisonCsv, useCampaignComparison } = await import("../useCampaignComparison");

const campanha = (id: number, name: string): CampaignDto => ({
  id,
  createdAt: "2026-08-01T00:00:00",
  updatedAt: null,
  name,
  startsAt: "2026-09-01T00:00:00",
  endsAt: "2026-09-30T23:59:59",
  isActive: true,
  questions: [],
});

const linha: CampaignComparisonRowDto = {
  campaignId: 3,
  campaignName: 'Setembro "2026"',
  startsAt: "2026-09-01T00:00:00",
  endsAt: "2026-09-30T23:59:59",
  windowStart: "2026-09-01T00:00:00",
  windowEnd: "2026-09-30T23:59:59",
  redemptions: 143,
  reversed: 4,
  salesCount: 143,
  revenue: 18420.5,
  profit: 5210.1,
  couponDiscount: 1842.05,
  averageTicket: 128.81,
  marginPercentage: 28.3,
  periodSalesCount: 980,
  periodRevenue: 121300,
  periodProfit: 38900,
  salesPercentage: 14.6,
  revenuePercentage: 15.2,
  profitPercentage: 13.4,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

/** Último objeto de parâmetros com que a query do comparativo foi chamada. */
function ultimaChamada() {
  const calls = mocks.useGetCampaignComparison.mock.calls;
  return calls[calls.length - 1][0] as { ids: number[]; from?: string; to?: string };
}

describe("useCampaignComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.useGetCampaigns.mockReturnValue({
      data: {
        data: [campanha(1, "Agosto 2026"), campanha(2, "Setembro 2026")],
        page: 1,
        limit: 30,
        total: 2,
        totalPages: 1,
      },
      isLoading: false,
    });

    mocks.useGetCampaignComparison.mockReturnValue({
      data: [linha],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deve começar sem seleção e sem recorte de período", () => {
    const { result } = renderHook(() => useCampaignComparison(), { wrapper: createWrapper() });

    expect(result.current.selectedIds).toEqual([]);
    expect(ultimaChamada()).toEqual({ ids: [], from: undefined, to: undefined });
    expect(result.current.metric.value).toBe("revenue");
  });

  it("deve marcar e desmarcar campanhas", () => {
    const { result } = renderHook(() => useCampaignComparison(), { wrapper: createWrapper() });

    act(() => result.current.toggleCampaign(1));
    act(() => result.current.toggleCampaign(2));
    expect(result.current.selectedIds).toEqual([1, 2]);
    expect(ultimaChamada().ids).toEqual([1, 2]);

    act(() => result.current.toggleCampaign(1));
    expect(result.current.selectedIds).toEqual([2]);
  });

  it("deve barrar a seleção acima do teto que o servidor aceita", () => {
    const { result } = renderHook(() => useCampaignComparison(), { wrapper: createWrapper() });

    act(() => {
      for (let id = 1; id <= MAX_COMPARISON_CAMPAIGNS; id += 1) result.current.toggleCampaign(id);
    });
    expect(result.current.selectedIds).toHaveLength(MAX_COMPARISON_CAMPAIGNS);

    act(() => result.current.toggleCampaign(99));

    expect(result.current.selectedIds).toHaveLength(MAX_COMPARISON_CAMPAIGNS);
    expect(result.current.selectedIds).not.toContain(99);
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Limite de campanhas atingido" }),
    );
  });

  it("deve converter o calendário em INSTANTE local, sem voltar um dia", () => {
    const { result } = renderHook(() => useCampaignComparison(), { wrapper: createWrapper() });

    act(() =>
      result.current.setDateRange({
        from: new Date(2026, 8, 1, 0, 0, 0),
        to: new Date(2026, 8, 30, 23, 59, 59),
      }),
    );

    // `toISOString()` devolveria "2026-09-30T02:59:59Z" no Brasil e o filtro
    // perderia o último dia inteiro da campanha.
    expect(ultimaChamada()).toEqual({
      ids: [],
      from: "2026-09-01T00:00:00",
      to: "2026-09-30T23:59:59",
    });
  });

  it("deve limpar a seleção sem mexer no recorte de período", () => {
    const { result } = renderHook(() => useCampaignComparison(), { wrapper: createWrapper() });

    act(() => result.current.toggleCampaign(1));
    act(() => result.current.setDateRange({ from: new Date(2026, 8, 1), to: undefined }));
    act(() => result.current.clearSelection());

    expect(result.current.selectedIds).toEqual([]);
    expect(ultimaChamada().from).toBe("2026-09-01T00:00:00");
  });

  it("deve trocar a métrica do gráfico", () => {
    const { result } = renderHook(() => useCampaignComparison(), { wrapper: createWrapper() });

    act(() => result.current.setMetricValue("share"));

    expect(result.current.metric.kind).toBe("percent");
    expect(result.current.metric.series.map((serie) => serie.dataKey)).toEqual([
      "revenuePercentage",
      "profitPercentage",
    ]);
  });

  it("deve cair na primeira métrica quando o valor guardado não existe mais", () => {
    const { result } = renderHook(() => useCampaignComparison(), { wrapper: createWrapper() });

    act(() => result.current.setMetricValue("metrica-que-nao-existe"));

    expect(result.current.metric.value).toBe("revenue");
  });

  it("deve buscar campanhas com debounce e voltar para a primeira página", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCampaignComparison(), { wrapper: createWrapper() });

    act(() => result.current.setSearchInput("setem"));
    act(() => vi.advanceTimersByTime(300));

    expect(mocks.useGetCampaigns).toHaveBeenLastCalledWith({
      search: "setem",
      page: 1,
      limit: 30,
    });
  });
});

describe("buildComparisonCsv", () => {
  it("deve abrir com BOM e cabeçalho separado por ponto e vírgula", () => {
    const csv = buildComparisonCsv([linha]);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split("\r\n")[0]).toBe(
      String.fromCharCode(0xfeff) +
        "Campanha;Início da campanha;Fim da campanha;Janela medida (início);" +
        "Janela medida (fim);Resgates;Estornos;Vendas;Faturamento;Lucro;Custo em cupons;" +
        "Ticket médio;Margem %;Vendas da loja;Faturamento da loja;Lucro da loja;" +
        "% das vendas;% do faturamento;% do lucro",
    );
  });

  it("deve escrever número com vírgula decimal e sem separador de milhar", () => {
    const colunas = buildComparisonCsv([linha]).split("\r\n")[1].split(";");

    // Faturamento: o Excel pt-BR só soma a coluna se o valor não vier como
    // "R$ 18.420,50", que ele importa como texto.
    expect(colunas[8]).toBe("18420,5");
    expect(colunas[10]).toBe("1842,05");
    expect(colunas[17]).toBe("15,2");
  });

  it("deve dobrar as aspas do nome da campanha para não quebrar a linha", () => {
    const colunas = buildComparisonCsv([linha]).split("\r\n")[1].split(";");

    expect(colunas[0]).toBe('"Setembro ""2026"""');
  });

  it("deve levar a janela medida, que é o que torna a linha reproduzível", () => {
    const colunas = buildComparisonCsv([linha]).split("\r\n")[1].split(";");

    expect(colunas[3]).toBe('"01/09/2026, 00:00"');
    expect(colunas[4]).toBe('"30/09/2026, 23:59"');
  });

  it("deve escrever 'Em aberto' quando o backend omite o fim da campanha", () => {
    const { endsAt: _omitido, ...semFim } = linha;
    const colunas = buildComparisonCsv([semFim]).split("\r\n")[1].split(";");

    expect(colunas[2]).toBe('"Em aberto"');
  });
});

describe("useCampaignComparison — exportação", () => {
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click");

  beforeEach(() => {
    vi.clearAllMocks();
    clickSpy.mockImplementation(() => {});

    // jsdom não implementa createObjectURL; sem o duble, exportar estouraria.
    URL.createObjectURL = vi.fn(() => "blob:comparativo");
    URL.revokeObjectURL = vi.fn();

    mocks.useGetCampaigns.mockReturnValue({ data: undefined, isLoading: false });
  });

  it("deve entregar o arquivo ao navegador e revogar a URL temporária", () => {
    mocks.useGetCampaignComparison.mockReturnValue({
      data: [linha],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCampaignComparison(), { wrapper: createWrapper() });
    act(() => result.current.handleExportCsv());

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:comparativo");
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Comparativo exportado." }));
  });

  it("não deve gerar arquivo vazio quando não há linha nenhuma", () => {
    mocks.useGetCampaignComparison.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCampaignComparison(), { wrapper: createWrapper() });
    act(() => result.current.handleExportCsv());

    expect(clickSpy).not.toHaveBeenCalled();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Nada para exportar" }));
  });
});

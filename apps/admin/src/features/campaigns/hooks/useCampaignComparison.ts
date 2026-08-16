import { useState } from "react";
import {
  MAX_COMPARISON_CAMPAIGNS,
  useGetCampaigns,
  useGetCampaignComparison,
  type CampaignComparisonRowDto,
} from "@workspace/api-client-react";
import { useDebounce, useToast, type DateRange } from "@workspace/ui";
import { formatDate, round2, toDateKey } from "@workspace/core";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";

/** Quantas campanhas o seletor carrega por vez. */
export const PICKER_PAGE_SIZE = 30;

/** Como o eixo e o tooltip do gráfico devem formatar a métrica. */
export type ComparisonMetricKind = "money" | "percent";

/** Uma leitura possível do comparativo — o que as barras representam. */
export interface ComparisonMetric {
  value: string;
  label: string;
  /** O que a métrica responde, exibido sob o título do gráfico. */
  description: string;
  kind: ComparisonMetricKind;
  /** Séries plotadas, na ordem em que recebem cor. */
  series: Array<{ dataKey: keyof CampaignComparisonRowDto; name: string }>;
}

/**
 * As quatro leituras do comparativo.
 *
 * Faturamento e lucro em reais só são comparáveis entre campanhas do mesmo
 * tamanho de janela — R$ 30 mil em dezembro e R$ 30 mil em fevereiro não são o
 * mesmo resultado. É por isso que a participação existe como métrica própria, e
 * não como nota de rodapé: 12% da loja e 25% da loja são comparáveis mesmo entre
 * meses de movimento completamente diferente.
 */
export const COMPARISON_METRICS: ComparisonMetric[] = [
  {
    value: "revenue",
    label: "Faturamento",
    description: "Soma do total das vendas com cupom, na janela de cada campanha.",
    kind: "money",
    series: [{ dataKey: "revenue", name: "Faturamento" }],
  },
  {
    value: "profit",
    label: "Lucro",
    description: "Já líquido do rateio do cupom por item e do desconto manual.",
    kind: "money",
    series: [{ dataKey: "profit", name: "Lucro" }],
  },
  {
    value: "averageTicket",
    label: "Ticket médio",
    description: "Faturamento dividido pelas vendas com cupom.",
    kind: "money",
    series: [{ dataKey: "averageTicket", name: "Ticket médio" }],
  },
  {
    value: "share",
    label: "% da loja",
    description:
      "Participação da campanha na loja, dentro da janela dela — a leitura comparável entre meses diferentes.",
    kind: "percent",
    series: [
      { dataKey: "revenuePercentage", name: "% do faturamento" },
      { dataKey: "profitPercentage", name: "% do lucro" },
    ],
  },
];

/**
 * Marca de ordem de bytes do UTF-8, escrita por código.
 *
 * Sem ela o Excel em português lê o arquivo como Latin-1 e "Início" chega na
 * planilha como "InÃ­cio". Vem de `fromCharCode` porque o caractere é invisível
 * no editor: colado cru no fonte, ele some no primeiro ajuste de formatação e a
 * regressão não aparece em nenhum diff legível.
 */
const UTF8_BOM = String.fromCharCode(0xfeff);

/** Colunas do CSV, na ordem em que saem no arquivo. */
const CSV_COLUMNS = [
  "Campanha",
  "Início da campanha",
  "Fim da campanha",
  "Janela medida (início)",
  "Janela medida (fim)",
  "Resgates",
  "Estornos",
  "Vendas",
  "Faturamento",
  "Lucro",
  "Custo em cupons",
  "Ticket médio",
  "Margem %",
  "Vendas da loja",
  "Faturamento da loja",
  "Lucro da loja",
  "% das vendas",
  "% do faturamento",
  "% do lucro",
] as const;

/**
 * Texto de uma célula, com as aspas dobradas.
 *
 * Nome de campanha com `;` ou com aspas quebraria a linha inteira do arquivo, e
 * o erro só apareceria na planilha de quem abriu — nunca aqui.
 */
function csvText(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Número de uma célula: duas casas e vírgula decimal, SEM separador de milhar e
 * sem símbolo de moeda.
 *
 * `formatCurrency` produziria "R$ 18.420,50", que o Excel pt-BR importa como
 * TEXTO — a coluna deixa de somar e o arquivo vira um relatório que não se pode
 * conferir. O arredondamento continua sendo o `round2` do core, o mesmo da tela.
 */
function csvNumber(value: number): string {
  return String(round2(value)).replace(".", ",");
}

/**
 * Monta o CSV do comparativo.
 *
 * `windowStart`/`windowEnd` viajam como colunas porque o arquivo é lido fora do
 * sistema, meses depois: faturamento sem a janela ao lado é um número que
 * ninguém consegue mais reproduzir.
 *
 * O separador é `;` e o arquivo abre com BOM UTF-8, como o export do inventário
 * — sem o BOM, o Excel em português lê "Início" como "InÃ­cio".
 */
export function buildComparisonCsv(rows: CampaignComparisonRowDto[]): string {
  const linhas = rows.map((row) =>
    [
      csvText(row.campaignName),
      csvText(formatDate(row.startsAt)),
      csvText(row.endsAt == null ? "Em aberto" : formatDate(row.endsAt)),
      csvText(formatDate(row.windowStart)),
      csvText(formatDate(row.windowEnd)),
      String(row.redemptions),
      String(row.reversed),
      String(row.salesCount),
      csvNumber(row.revenue),
      csvNumber(row.profit),
      csvNumber(row.couponDiscount),
      csvNumber(row.averageTicket),
      csvNumber(row.marginPercentage),
      String(row.periodSalesCount),
      csvNumber(row.periodRevenue),
      csvNumber(row.periodProfit),
      csvNumber(row.salesPercentage),
      csvNumber(row.revenuePercentage),
      csvNumber(row.profitPercentage),
    ].join(";"),
  );

  return `${UTF8_BOM}${[CSV_COLUMNS.join(";"), ...linhas].join("\r\n")}\r\n`;
}

/**
 * Entrega o arquivo ao navegador.
 *
 * O app roda no navegador e não tem servidor de arquivos: o caminho é o mesmo do
 * export do inventário — Blob, URL temporária e um `<a download>` clicado por
 * código. A URL é revogada depois porque o Blob fica na memória da aba até isso
 * acontecer, e quem exporta o comparativo várias vezes seguidas acumularia todos.
 */
function downloadCsv(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * useCampaignComparison
 *
 * Hook controlador da tela de comparativo entre campanhas: escolha das
 * campanhas, recorte opcional de período, métrica do gráfico e exportação CSV.
 *
 * O recorte de período só ENCOLHE a janela de cada campanha (interseção). Uma
 * campanha de agosto consultada com filtro de setembro sai zerada, e não com as
 * vendas de setembro: medir uma campanha fora do ar contra um denominador em que
 * ela não estava rodando produziria participação inventada.
 */
export function useCampaignComparison() {
  const { toast } = useToast();

  const [searchInput, setSearchInput] = useState("");
  // Sem número próprio: o atraso é o `DEFAULT_DEBOUNCE_MS` do kit, o mesmo das
  // outras buscas do admin.
  const search = useDebounce(searchInput);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [metricValue, setMetricValue] = useState(COMPARISON_METRICS[0].value);

  const { data: paged, isLoading: isLoadingCampaigns } = useGetCampaigns({
    search: search.trim() || undefined,
    page: 1,
    limit: PICKER_PAGE_SIZE,
  });

  // O calendário entrega Date de dia inteiro, mas a campanha é controlada por
  // INSTANTE: a string é composta à mão a partir de `toDateKey`, que lê o
  // fuso local. `toISOString()` aqui converteria para UTC e o filtro voltaria um
  // dia no Brasil (armadilha 2 do CLAUDE.md).
  const from = dateRange.from ? `${toDateKey(dateRange.from)}T00:00:00` : undefined;
  const to = dateRange.to ? `${toDateKey(dateRange.to)}T23:59:59` : undefined;

  const {
    data: rows,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetCampaignComparison({ ids: selectedIds, from, to });

  useApiErrorToast(isError, error);

  // A seleção sobrevive à busca: filtrar o seletor não desmarca ninguém, e a
  // campanha marcada que saiu do filtro continua no gráfico e na tabela, onde o
  // nome dela aparece. Desmarcar por busca faria o comparativo mudar sozinho
  // enquanto o usuário procura a próxima campanha.
  const campaigns = paged?.data ?? [];

  /**
   * Marca ou desmarca uma campanha.
   *
   * O teto é o do servidor, que responde 400 acima dele. Barrar aqui com um
   * aviso é melhor do que deixar o clique virar erro de API — e o limite existe
   * porque doze barras já é o máximo que um comparativo mostra sem virar borrão.
   */
  function toggleCampaign(id: number) {
    setSelectedIds((atual) => {
      if (atual.includes(id)) return atual.filter((selecionado) => selecionado !== id);

      if (atual.length >= MAX_COMPARISON_CAMPAIGNS) {
        toast({
          title: "Limite de campanhas atingido",
          description: `Compare no máximo ${MAX_COMPARISON_CAMPAIGNS} campanhas por vez.`,
          variant: "warning",
        });
        return atual;
      }

      return [...atual, id];
    });
  }

  /** Limpa a seleção; a consulta volta a ficar desligada. */
  function clearSelection() {
    setSelectedIds([]);
  }

  /** Exporta o comparativo exibido para CSV. */
  function handleExportCsv() {
    if (!rows || rows.length === 0) {
      toast({
        title: "Nada para exportar",
        description: "Escolha ao menos uma campanha com movimento na janela selecionada.",
        variant: "warning",
      });
      return;
    }

    downloadCsv(buildComparisonCsv(rows), `Comparativo_Campanhas_${toDateKey(new Date())}.csv`);
    toast({ title: "Comparativo exportado.", description: `${rows.length} campanha(s) no arquivo.` });
  }

  // Métrica removida da lista (ou valor inválido vindo de um estado antigo) não
  // pode deixar o gráfico sem série nenhuma.
  const metric = COMPARISON_METRICS.find((item) => item.value === metricValue) ?? COMPARISON_METRICS[0];

  return {
    searchInput,
    setSearchInput,
    campaigns,
    isLoadingCampaigns,
    selectedIds,
    toggleCampaign,
    clearSelection,
    maxCampaigns: MAX_COMPARISON_CAMPAIGNS,
    dateRange,
    setDateRange,
    metric,
    metricValue: metric.value,
    setMetricValue,
    metrics: COMPARISON_METRICS,
    rows: rows ?? [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    handleExportCsv,
  };
}

import {
  useGetCampaignReport,
  type CampaignReportDailyPointDto,
  type CampaignReportDto,
} from "@workspace/api-client-react";
import { formatDate, formatPercentage } from "@workspace/core";
import { useApiErrorToast } from "@/hooks/use-api-error-toast";

/**
 * Como os dois lados do card devem ser formatados.
 *
 * O hook devolve número cru e o componente formata: dinheiro sai por
 * `formatCurrency` do core, contagem por `toLocaleString("pt-BR")`. Formatar
 * aqui devolveria string e o gráfico perderia o número.
 */
export type CampaignReportCardKind = "money" | "count";

/**
 * Um indicador do relatório com o SEU denominador ao lado.
 *
 * O denominador é a razão de existir da tela. "A campanha faturou R$ 18 mil"
 * não é conclusão nenhuma: pode ser 15% de um mês bom ou 90% de um mês morto, e
 * os dois casos pedem decisões opostas. Todo card que tem um número comparável
 * da loja no MESMO intervalo carrega os dois lados e a participação.
 */
export interface CampaignReportCard {
  key: string;
  label: string;
  kind: CampaignReportCardKind;
  /** O número da campanha. */
  campaignValue: number;
  /**
   * O mesmo número da loja inteira no mesmo intervalo.
   *
   * `null` quando não existe denominador honesto — estorno de resgate e desconto
   * de cupom não têm equivalente na loja, e inventar um faria a tela afirmar
   * algo que o backend não mediu.
   */
  periodValue: number | null;
  /**
   * Participação da campanha na loja, em pontos percentuais.
   *
   * `null` quando a razão entre os dois lados não seria participação. É o caso
   * do ticket médio: dividir uma média pela outra dá um índice de comparação,
   * não "quanto da loja a campanha moveu", e o leitor somaria os cards como se
   * fosse a mesma coisa.
   */
  sharePercentage: number | null;
  /** Uma linha explicando o que o card responde ou a ressalva dele. */
  note?: string;
}

/**
 * Percentual de uma parte sobre um total, protegido de divisão por zero.
 *
 * Campanha sem faturamento existe (todos os resgates estornados, por exemplo), e
 * `0 / 0` viraria `NaN` no meio de um card.
 */
function share(part: number, total: number): number {
  return total === 0 ? 0 : (part / total) * 100;
}

/**
 * Linha de apoio do card de estornos.
 *
 * Junta os dois contadores que só aparecem aqui: resgate que entrou com o limite
 * do cupom já esgotado (sempre pela fila offline — o backend nunca recusa venda
 * já paga por causa do cupom) e resgate cujo snapshot não bate com a definição
 * atual. Ambos diferentes de zero são notícia: o primeiro significa que a ação
 * custou mais do que o orçamento previa.
 */
function reversedNote(report: CampaignReportDto): string {
  const avisos: string[] = [];
  if (report.overLimit > 0) avisos.push(`${report.overLimit} acima do limite do cupom`);
  if (report.definitionDrift > 0) avisos.push(`${report.definitionDrift} com definição divergente`);

  return avisos.length > 0 ? avisos.join(" · ") : "Resgate estornado sai de todas as somas de dinheiro.";
}

/**
 * Monta os cards do relatório a partir do DTO.
 *
 * Função pura e exportada para poder ser verificada sem montar a árvore de
 * componentes — é ela que decide quais números ganham denominador.
 */
export function buildReportCards(report: CampaignReportDto): CampaignReportCard[] {
  const { campaign, period } = report;

  return [
    {
      key: "redemptions",
      label: "Resgates",
      kind: "count",
      campaignValue: report.redemptions,
      periodValue: period.salesCount,
      sharePercentage: report.share.salesPercentage,
      note: "Um cupom por venda — resgate válido e venda com cupom são o mesmo número.",
    },
    {
      key: "reversed",
      label: "Estornos",
      kind: "count",
      campaignValue: report.reversed,
      periodValue: null,
      sharePercentage: null,
      note: reversedNote(report),
    },
    {
      key: "revenue",
      label: "Faturamento",
      kind: "money",
      campaignValue: campaign.revenue,
      periodValue: period.revenue,
      sharePercentage: report.share.revenuePercentage,
      note: "Soma do total das vendas, já líquida do desconto.",
    },
    {
      key: "profit",
      label: "Lucro",
      kind: "money",
      campaignValue: campaign.profit,
      periodValue: period.profit,
      sharePercentage: report.share.profitPercentage,
      note: "Já descontado o rateio do cupom por item — sem isso a campanha pareceria mais lucrativa do que foi.",
    },
    {
      key: "averageTicket",
      label: "Ticket médio",
      kind: "money",
      campaignValue: campaign.averageTicket,
      periodValue: period.averageTicket,
      // Razão entre médias não é participação: 128,81 sobre 123,77 não significa
      // "104% da loja". Os dois lados ficam visíveis e a comparação é do leitor.
      sharePercentage: null,
      note: "Compare os dois lados: ticket acima do da loja indica carrinho maior, não mais clientes.",
    },
    {
      key: "couponDiscount",
      label: "Custo em cupons",
      kind: "money",
      campaignValue: campaign.couponDiscount,
      periodValue: null,
      sharePercentage: null,
      note: `${formatPercentage(share(campaign.couponDiscount, campaign.revenue))} do faturamento da campanha`,
    },
  ];
}

/**
 * Rótulo do intervalo analisado.
 *
 * Campanha em aberto é medida até agora, e isso precisa estar escrito: sem o
 * aviso, quem abre a tela às 10h da manhã compara meio dia de campanha com meio
 * dia de loja e acha que o resultado caiu.
 */
export function describeReportWindow(startsAt: string, endsAt?: string | null): string {
  const inicio = formatDate(startsAt);
  return endsAt == null ? `${inicio} até agora (campanha em aberto)` : `${inicio} até ${formatDate(endsAt)}`;
}

/**
 * useCampaignReport
 *
 * Hook controlador da tela de relatório de uma campanha. Só leitura: nada nesta
 * tela escreve no servidor.
 *
 * O recorte NÃO é escolhido pelo usuário de propósito — é sempre o intervalo da
 * campanha. Um filtro de período aqui produziria faturamento de campanha sem
 * denominador correspondente (cupom vinculado a campanha encerrada continua
 * valendo, §5.5 do contrato), e a participação passaria de 100% da loja sem
 * explicação. Quem quer recortar por período usa o comparativo.
 *
 * @param campaignId Campanha do relatório; indefinido mantém a query desligada.
 */
export function useCampaignReport(campaignId?: number) {
  const { data: report, isLoading, isFetching, isError, error, refetch } = useGetCampaignReport(campaignId);

  // 5xx não tem o que o usuário corrigir e deixaria a tela vazia sem explicação;
  // 4xx (campanha inexistente) vira o estado de erro da página, com a mensagem
  // do backend.
  useApiErrorToast(isError, error);

  const cards = report ? buildReportCards(report) : [];
  const daily: CampaignReportDailyPointDto[] = report?.daily ?? [];

  // Série toda em zero não é gráfico, é uma reta rente ao eixo: a tela mostra o
  // estado vazio em vez de sugerir que houve movimento medido.
  const hasDailyMovement = daily.some((point) => point.campaignRevenue !== 0 || point.periodRevenue !== 0);

  return {
    report,
    cards,
    daily,
    hasDailyMovement,
    windowLabel: report ? describeReportWindow(report.startsAt, report.endsAt) : "",
    questions: report?.questions ?? [],
    coupons: report?.coupons ?? [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  };
}

import { apiGetOrThrow, apiPost } from "@workspace/api-client-react";
import type {
  DashboardChampions,
  DashboardIntelligence,
  DashboardMonthly,
  DashboardOverview,
  DashboardPatterns,
  DashboardPatternsRefresh,
  DashboardToday,
} from "./types";

/**
 * Acesso aos indicadores do painel (`/Dashboard` no backend).
 *
 * Os recortes são endpoints separados de propósito: visão geral e dia corrente
 * são leves e sobem junto com a tela, enquanto padrões históricos e inteligência
 * comercial são pesados e só são buscados quando o usuário pede.
 */

/**
 * Totais do período, comparativo com a base pedida, série diária e quebras por
 * categoria, forma de pagamento e produto.
 *
 * @param params Intervalo e base de comparação em `yyyy-MM-dd`, e tamanho do
 * ranking de produtos. Sem a base, o backend compara com o período anterior de
 * igual duração.
 */
export async function getDashboardOverview(params: {
  startDate: string;
  endDate: string;
  compareStartDate?: string;
  compareEndDate?: string;
  topProducts?: number;
}) {
  return apiGetOrThrow<DashboardOverview>("/Dashboard/overview", {
    startDate: params.startDate,
    endDate: params.endDate,
    compareStartDate: params.compareStartDate,
    compareEndDate: params.compareEndDate,
    topProducts: params.topProducts ?? 8,
  });
}

/**
 * Faturamento do dia corrente, com as comparações recortadas no mesmo horário.
 * Pensado para ser consultado repetidamente enquanto a loja vende.
 */
export async function getDashboardToday() {
  return apiGetOrThrow<DashboardToday>("/Dashboard/today");
}

/**
 * Mês corrente contra o anterior, mais o histórico dos meses fechados.
 *
 * @param months Meses no histórico, incluindo o corrente.
 */
export async function getDashboardMonthly(months = 12) {
  return apiGetOrThrow<DashboardMonthly>("/Dashboard/monthly", { months });
}

/**
 * Produtos campeões: o ranking por lucro de uma janela fixa de dias, com o
 * estoque de cada um lido como alerta.
 *
 * @param params Janela em dias e quantos produtos trazer (o "Ver mais" aumenta).
 */
export async function getDashboardChampions(params: { days: number; take: number }) {
  return apiGetOrThrow<DashboardChampions>("/Dashboard/champions", { days: params.days, take: params.take });
}

/**
 * Padrões históricos por dia da semana, hora do dia e dia do mês.
 *
 * Lê a tabela pré-processada `dashboard_sales_hourly`; o backend a recalcula
 * sozinho quando passa de doze horas sem atualização.
 *
 * @param months Janela analisada, em meses.
 */
export async function getDashboardPatterns(months = 12) {
  return apiGetOrThrow<DashboardPatterns>("/Dashboard/patterns", { months });
}

/**
 * Força o recálculo da tabela pré-processada dos padrões.
 *
 * @param full Verdadeiro reconstrói o histórico inteiro em vez das últimas semanas.
 */
export async function refreshDashboardPatterns(full = false) {
  const response = await apiPost<DashboardPatternsRefresh>(`/Dashboard/patterns/refresh?full=${full}`);
  return response.data;
}

/**
 * Inteligência comercial: prioridade de reposição, afinidade entre produtos e
 * candidatos a produto-isca.
 *
 * @param params Janela de vendas analisada e tamanho de cada lista.
 */
export async function getDashboardIntelligence(params?: { lookbackDays?: number; take?: number }) {
  return apiGetOrThrow<DashboardIntelligence>("/Dashboard/intelligence", {
    lookbackDays: params?.lookbackDays ?? 90,
    take: params?.take ?? 10,
  });
}

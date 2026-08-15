import { apiGetOrThrow, apiPost } from "@workspace/api-client-react";
import type {
  DashboardIntelligence,
  DashboardMonthly,
  DashboardOverview,
  DashboardPatterns,
  DashboardPatternsRefresh,
  DashboardToday,
} from "@/features/dashboard/types";

/**
 * Acesso aos indicadores do painel (`/Dashboard` no backend).
 *
 * Os recortes são endpoints separados de propósito: visão geral e dia corrente
 * são leves e sobem junto com a tela, enquanto padrões históricos e inteligência
 * comercial são pesados e só são buscados quando o usuário pede.
 */

/**
 * Totais do período, comparativo com o período anterior de igual duração, série
 * diária e quebras por categoria, forma de pagamento e produto.
 *
 * @param params Intervalo em `yyyy-MM-dd` e tamanho do ranking de produtos.
 */
export async function getDashboardOverview(params: {
  startDate: string;
  endDate: string;
  topProducts?: number;
}) {
  return apiGetOrThrow<DashboardOverview>("/Dashboard/overview", {
    startDate: params.startDate,
    endDate: params.endDate,
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
  const response = await apiPost<DashboardPatternsRefresh>(
    `/Dashboard/patterns/refresh?full=${full}`,
  );
  return response.data;
}

/**
 * Inteligência comercial: prioridade de reposição, afinidade entre produtos e
 * candidatos a produto-isca.
 *
 * @param params Janela de vendas analisada e tamanho de cada lista.
 */
export async function getDashboardIntelligence(params?: {
  lookbackDays?: number;
  take?: number;
}) {
  return apiGetOrThrow<DashboardIntelligence>("/Dashboard/intelligence", {
    lookbackDays: params?.lookbackDays ?? 90,
    take: params?.take ?? 10,
  });
}

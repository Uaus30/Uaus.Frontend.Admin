/**
 * Estoque congelado pela conferência de estoque em andamento (`GET /Pdv/status`).
 *
 * Com a conferência aberta, o servidor recusa venda, cancelamento de venda,
 * entrada e baixa (decisão do dono, 23/09/2026): a contagem compara a prateleira
 * com o saldo, e um saldo que anda enquanto alguém conta dá a diferença errada.
 * Esta consulta é o que deixa as telas avisarem ANTES — a faixa no topo, o
 * FINALIZAR do PDV travado — em vez de o operador descobrir na recusa.
 *
 * Mora sob `/Pdv` por causa da autorização: a rota da conferência é só de
 * Administrador, e o caixa entra como Vendedor. Esta é liberada para os dois.
 */

import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { ApiError, apiGetOrThrow } from "../client";
import type { QueryKey } from "../models";

export interface PdvStatusDto {
  /** Vendas, cancelamentos, entradas e baixas pausados pela conferência aberta. */
  salesPaused: boolean;
  /** O motivo, como o servidor o escreve. Ausente com as vendas liberadas. */
  pausedReason?: string;
  /** Desde quando (horário da loja, sem fuso). Ausente com as vendas liberadas. */
  pausedSince?: string;
}

/** Intervalo da consulta: o bastante para o balcão travar logo depois de a conferência abrir. */
export const STOCK_FREEZE_POLL_MS = 30_000;

export const getGetStockFreezeStatusQueryKey = (): QueryKey => ["Pdv", "status"];

export async function getStockFreezeStatus(): Promise<PdvStatusDto> {
  return apiGetOrThrow<PdvStatusDto>("/Pdv/status");
}

/**
 * O estado do congelamento, reconsultado a cada {@link STOCK_FREEZE_POLL_MS}.
 * Quem abre ou encerra a conferência invalida a chave para a tela mudar na hora.
 */
export function useGetStockFreezeStatus(options?: {
  query?: Omit<UseQueryOptions<PdvStatusDto, ApiError, PdvStatusDto, QueryKey>, "queryKey" | "queryFn">;
}) {
  return useQuery<PdvStatusDto, ApiError, PdvStatusDto, QueryKey>({
    queryKey: getGetStockFreezeStatusQueryKey(),
    queryFn: getStockFreezeStatus,
    refetchInterval: STOCK_FREEZE_POLL_MS,
    ...options?.query,
  });
}

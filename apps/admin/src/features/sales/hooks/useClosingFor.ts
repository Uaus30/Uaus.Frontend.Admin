import { useCallback } from "react";
import { useGetFinancialClosings } from "@workspace/api-client-react";
import { findClosing, type ClosedPeriod } from "../lib/closed-periods";

/** Fechamentos são um por mês: cem cobrem mais de oito anos. */
const CLOSINGS_LIMIT = 100;

/**
 * O fechamento financeiro que cobre um dia, para a venda avisar ANTES de gravar
 * que o fechamento vai ficar desatualizado (decisão do dono, 06/10/2026). A
 * Nova venda e a correção leem a mesma lista — uma consulta só, pela chave.
 */
export function useClosingFor(): (date: string) => ClosedPeriod | null {
  const { data } = useGetFinancialClosings({ page: 1, limit: CLOSINGS_LIMIT });
  const closings = data?.data;
  return useCallback((date: string) => findClosing(closings ?? [], date), [closings]);
}

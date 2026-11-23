import { useState } from "react";
import { useGetPurchaseBudget } from "@workspace/api-client-react";
import { toMonthKey } from "@workspace/core";

/**
 * A faixa de compras do mês corrente, para o cartão do Dashboard.
 *
 * O mês é sempre o de calendário, qualquer que seja o período do seletor do
 * painel — como a matriz do mês: a faixa responde "o mês aguenta mais
 * compras?", e essa pergunta só existe para o mês que está correndo.
 */
export function usePurchaseBandCard() {
  const [month] = useState(() => toMonthKey(new Date()));
  const { data, isLoading } = useGetPurchaseBudget({ month });
  return { budget: data, isLoading };
}

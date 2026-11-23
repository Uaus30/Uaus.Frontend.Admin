import { useState } from "react";
import { useGetPurchaseBudget } from "@workspace/api-client-react";
import { toMonthKey } from "@workspace/core";

/**
 * A faixa do mês CORRENTE, para a faixa no topo da listagem de Compras.
 *
 * O mês é lido uma vez, na montagem, pelos componentes locais — a tela aberta
 * de um dia para o outro continua no mês em que abriu, como o resto do admin.
 */
export function useMonthPurchaseBudget() {
  const [month] = useState(() => toMonthKey(new Date()));
  return useGetPurchaseBudget({ month }).data;
}

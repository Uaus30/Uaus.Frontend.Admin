import { Snowflake } from "lucide-react";
import { Link } from "wouter";
import { useGetStockFreezeStatus } from "@workspace/api-client-react";
import { formatDate } from "@workspace/core";
import { inventoryCountTabPathname } from "@/features/inventory/inventory-tabs";

/**
 * A faixa "estoque congelado" (23/09/2026), no topo de toda tela do admin
 * enquanto houver conferência de estoque aberta.
 *
 * Com a conferência aberta o servidor recusa venda, cancelamento, entrada e
 * baixa. A recusa já chega com a mensagem certa em qualquer tela; a faixa existe
 * para ninguém descobrir pela recusa — e para quem abriu a conferência não
 * esquecer que a loja está parada. O link leva a quem pode encerrar.
 *
 * Âmbar, e não vermelho: nada quebrou, é um estado previsto que pede atenção.
 * Com ícone e texto, nunca a cor sozinha.
 */
export function StockFreezeBanner() {
  const { data } = useGetStockFreezeStatus();

  if (!data?.salesPaused) return null;

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500/40 bg-amber-500/15 px-6 py-2 text-center text-sm font-medium text-amber-800 dark:text-amber-200"
    >
      <span className="flex items-center gap-2">
        <Snowflake className="h-4 w-4 shrink-0" />
        Conferência de estoque em andamento
        {data.pausedSince ? ` desde ${formatDate(data.pausedSince)}` : ""}: vendas, entradas, baixas e
        cancelamentos estão pausados.
      </span>
      <Link href={inventoryCountTabPathname()} className="underline underline-offset-2">
        Ver conferência
      </Link>
    </div>
  );
}

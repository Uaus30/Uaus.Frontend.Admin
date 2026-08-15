import { useCallback, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { clearAuthSession } from "@workspace/api-client-react";
import { describeApiError, formatCurrency } from "@workspace/core";
import { useToast } from "@workspace/ui";
import { usePdvStore } from "@/stores/use-pdv-store";
import { useOfflineStore } from "@/stores/use-offline-store";
import { clearLocalCatalog, closeLocalDatabase, type QueueSyncOutcome } from "@/offline";
import { canCloseRegister } from "@/lib/cash-register";

export interface UsePdvSessionActionsParams {
  /** Sessão de caixa aberta, ou `null`. */
  sessionId: number | null;
  online: boolean;
  /** Vendas **e** baixas que o servidor ainda não conhece. */
  queuedCount: number;
  /** Abre a sessão de caixa (vem do `useCashRegister`). */
  openCashRegister: (openingBalance: number, openingNotes?: string) => Promise<void>;
  /** Tenta subir a fila agora, a pedido do operador. */
  syncPendingQueues: () => Promise<QueueSyncOutcome | null>;
}

/**
 * Começo e fim do turno: abrir o caixa, pedir o fechamento e sair do PDV.
 *
 * As três compartilham a mesma pergunta — o que o servidor ainda não sabe? —, e
 * é ela que decide se o operador pode seguir. Movimento preso no navegador é o
 * que transforma um fechamento em divergência de caixa.
 */
export function usePdvSessionActions({
  sessionId,
  online,
  queuedCount,
  openCashRegister,
  syncPendingQueues,
}: UsePdvSessionActionsParams) {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCloseRegisterOpen, setIsCloseRegisterOpen] = useState(false);
  const clearSession = usePdvStore((state) => state.clearSession);

  /**
   * Abre o caixa com o fundo de troco já validado pelo diálogo.
   *
   * @returns `true` quando o caixa abriu — é o que autoriza o diálogo a limpar
   *   os campos. Em caso de falha eles ficam como estão, para o operador não ter
   *   que redigitar o valor contado.
   */
  const openRegister = useCallback(
    async (value: number, obs: string): Promise<boolean> => {
      try {
        await openCashRegister(value, obs);
        toast({
          title: "Caixa aberto!",
          description: `Fundo de troco: ${formatCurrency(value)}`,
          className: "bg-emerald-500 text-white border-none",
        });
        return true;
      } catch (error) {
        toast({
          title: "Não foi possível abrir o caixa",
          description: describeApiError(error),
          variant: "destructive",
        });
        return false;
      }
    },
    [openCashRegister, toast],
  );

  /**
   * Abre o diálogo de fechamento, se o caixa puder ser fechado agora.
   *
   * Movimento pendente bloqueia o fechamento — a regra e os dois motivos estão
   * em `lib/cash-register.ts`, com teste. Antes de recusar, tenta sincronizar:
   * na maioria das vezes a fila sobe e o operador segue direto.
   */
  const requestCloseRegister = useCallback(async () => {
    if (queuedCount > 0 && online) {
      await syncPendingQueues();
    }

    // Reconsulta o store: a sincronização acima pode ter esvaziado a fila. As
    // recusadas contam junto — elas também são movimento que o servidor não
    // conhece, e é isso que o fechamento precisa saber.
    const fila = useOfflineStore.getState();
    const pendentes = fila.pending + fila.failed + fila.pendingWriteOffs + fila.failedWriteOffs;
    const check = canCloseRegister({ sessionId, queuedCount: pendentes });

    if (!check.allowed) {
      toast({
        title: check.reason === "fila-pendente" ? "Há movimentos não sincronizados" : "Nenhum caixa aberto",
        description:
          check.reason === "fila-pendente"
            ? `${pendentes} movimento(s) ainda não subiram para o servidor. O fechamento contaria uma gaveta que o servidor não conhece — resolva a fila em "Operação offline" primeiro.`
            : "Não há sessão de caixa aberta para fechar.",
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    setIsCloseRegisterOpen(true);
  }, [online, queuedCount, sessionId, syncPendingQueues, toast]);

  /**
   * Encerra a sessão do operador de verdade: token, cadastros locais e stores.
   *
   * Antes, "sair" só zerava o carrinho e o cache de consultas — o JWT continuava
   * no localStorage (navegar de volta para "/" reautenticava o operador
   * anterior) e a base local seguia legível com nome/CPF/telefone de clientes.
   *
   * As filas offline **nunca** são apagadas aqui: quem chama garante que não há
   * pendência (a saída é bloqueada enquanto houver), e `clearLocalCatalog` só
   * toca o cadastro.
   */
  const logout = useCallback(async () => {
    // O token sai primeiro: mesmo que a limpeza da base local falhe, a sessão
    // não pode continuar reutilizável.
    clearAuthSession();
    clearSession();
    useOfflineStore.getState().reset();

    try {
      await clearLocalCatalog();
    } catch {
      // Navegador sem IndexedDB ou base bloqueada por outra aba: não há
      // cadastro a limpar (ou não dá para limpar agora) — a saída segue.
    }

    closeLocalDatabase();
    queryClient.clear();
    setLocation("/login");
  }, [clearSession, queryClient, setLocation]);

  /** Sai do PDV. Bloqueia a saída com caixa aberto ou com movimento pendente. */
  const exit = useCallback(() => {
    if (sessionId) {
      toast({
        title: "Fechamento necessário",
        description: "Não é possível sair com o caixa aberto. Efetue o fechamento primeiro.",
        variant: "destructive",
        duration: 4000,
      });
      return;
    }

    // Sair com fila pendente deixaria venda/baixa presa neste navegador — e o
    // logout limpa o cadastro local, então o operador seguinte nem saberia da
    // pendência. Sincronizar primeiro é obrigatório.
    if (queuedCount > 0) {
      toast({
        title: "Há movimentos não sincronizados",
        description: online
          ? `${queuedCount} venda(s)/baixa(s) ainda não subiram para o servidor. Resolva a fila em "Operação offline" antes de sair.`
          : `${queuedCount} movimento(s) offline aguardando conexão. Saia somente depois que eles subirem.`,
        variant: "destructive",
        duration: 8000,
      });
      return;
    }

    void logout();
  }, [logout, online, queuedCount, sessionId, toast]);

  /**
   * Saída pelo diálogo de abertura de caixa, antes de o turno começar.
   *
   * Limpa só o cache de consultas — **não** o token nem o cadastro local, ao
   * contrário de {@link exit}. A diferença é anterior a esta extração e está
   * preservada como estava; o comportamento das duas saídas precisa ser
   * decidido junto, não aqui.
   */
  const leaveWithoutSession = useCallback(() => {
    queryClient.clear();
    setLocation("/login");
  }, [queryClient, setLocation]);

  return {
    openRegister,
    requestCloseRegister,
    /** O diálogo de fechamento está aberto. */
    isCloseRegisterOpen,
    setIsCloseRegisterOpen,
    exit,
    leaveWithoutSession,
  };
}

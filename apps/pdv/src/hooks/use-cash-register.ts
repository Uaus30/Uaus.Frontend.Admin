import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CURRENT_CASH_REGISTER_SESSION_QUERY_KEY,
  closeCashRegisterSession,
  openCashRegisterSession,
  useGetCurrentCashRegisterSession,
  type CashRegisterSessionDto,
} from "@workspace/api-client-react";
import {
  readCachedCashRegisterSession,
  writeCachedCashRegisterSession,
} from "@/offline";
import { getSessionSales } from "@/services/sales.service";

/**
 * useCashRegister
 *
 * Sessão de caixa aberta do operador e as vendas registradas nela.
 * Enquanto não houver sessão aberta o PDV não permite vender.
 *
 * Responsabilidades:
 * - Manter a sessão aberta em cache e expor o resumo consolidado do backend.
 * - Guardar a sessão na base local, para o PDV sobreviver a um recarregamento
 *   sem internet — o caso da queda de energia.
 * - Carregar as vendas da sessão para o histórico.
 * - Abrir e fechar o caixa, invalidando o cache após cada operação.
 */
export function useCashRegister() {
  const queryClient = useQueryClient();

  const {
    data: session,
    isLoading: loadingSession,
    refetch: refetchSession,
  } = useGetCurrentCashRegisterSession({ query: { retry: false } });

  /**
   * Sessão recuperada da base local.
   *
   * Só entra em cena quando a API não respondeu: depois de uma queda de energia a
   * máquina reinicia sem internet, o caixa continua aberto no servidor e
   * `/CashRegisterSessions/current` não tem como dizer qual é. Sem esta cópia o
   * operador cairia na tela de abertura de caixa, que também exige internet — e o
   * PDV ficaria travado justamente na situação para a qual o offline existe.
   */
  const [cachedSession, setCachedSession] = useState<CashRegisterSessionDto | null>(null);

  useEffect(() => {
    let active = true;

    void readCachedCashRegisterSession<CashRegisterSessionDto>()
      .then((stored) => {
        if (active) setCachedSession(stored);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  // A cópia local acompanha o que o servidor confirmou: a sessão aberta é
  // guardada, e o caixa fechado (ou a ausência de sessão) apaga a cópia para não
  // ressuscitar uma sessão encerrada no próximo recarregamento.
  useEffect(() => {
    if (session === undefined) return;

    setCachedSession(session ?? null);
    void writeCachedCashRegisterSession(session ?? null).catch(() => undefined);
  }, [session]);

  const activeSession = session ?? cachedSession;
  const sessionId = activeSession?.id ?? null;

  /** A sessão em uso veio da base local porque a API não respondeu. */
  const isSessionFromCache = session == null && cachedSession != null;

  const { data: sales = [], isLoading: loadingSales } = useQuery({
    queryKey: ["pdv-session-sales", sessionId],
    queryFn: () => getSessionSales(sessionId as number),
    enabled: !!sessionId,
  });

  /**
   * Recarrega as vendas da sessão e o resumo do caixa. Chamado após registrar,
   * editar ou cancelar uma venda.
   */
  const refreshSales = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["pdv-session-sales", sessionId] });
    await queryClient.invalidateQueries({ queryKey: CURRENT_CASH_REGISTER_SESSION_QUERY_KEY });
  }, [queryClient, sessionId]);

  /**
   * Abre o caixa do operador autenticado.
   *
   * Exige conexão: a sessão é a âncora contábil da venda, e criá-la localmente
   * exigiria reconciliação depois, com risco de duplicar caixa.
   *
   * @param openingBalance Fundo de troco colocado na gaveta.
   * @param openingNotes Observações da abertura.
   */
  const open = useCallback(
    async (openingBalance: number, openingNotes?: string) => {
      await openCashRegisterSession({ openingBalance, openingNotes: openingNotes?.trim() || null });
      await queryClient.invalidateQueries({ queryKey: CURRENT_CASH_REGISTER_SESSION_QUERY_KEY });
      await refetchSession();
    },
    [queryClient, refetchSession],
  );

  /**
   * Fecha a sessão aberta conferindo o dinheiro em gaveta.
   *
   * @param countedAmount Dinheiro em espécie contado na gaveta.
   * @param closingNotes Observações do fechamento.
   * @returns A sessão fechada, com esperado e diferença calculados pelo backend.
   * @throws Quando não há caixa aberto.
   */
  const close = useCallback(
    async (countedAmount: number, closingNotes?: string) => {
      if (!sessionId) throw new Error("Nenhum caixa aberto para fechar.");
      const closed = await closeCashRegisterSession(sessionId, {
        countedAmount,
        closingNotes: closingNotes?.trim() || null,
      });

      // A cópia local é apagada aqui, e não só pelo efeito acima: o caixa fechado
      // não pode voltar num recarregamento offline.
      setCachedSession(null);
      await writeCachedCashRegisterSession(null).catch(() => undefined);

      await queryClient.invalidateQueries({ queryKey: CURRENT_CASH_REGISTER_SESSION_QUERY_KEY });
      return closed;
    },
    [queryClient, sessionId],
  );

  return {
    session: activeSession ?? null,
    sessionId,
    /** A sessão em uso veio da base local; o resumo do caixa pode estar defasado. */
    isSessionFromCache,
    summary: activeSession?.summary ?? null,
    sales,
    loadingSession,
    loadingSales,
    open,
    close,
    refreshSales,
  };
}

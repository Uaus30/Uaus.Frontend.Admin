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
 *
 * @param options `enabled: false` desliga a consulta inteira — é o modo sem
 *   controle de caixa, em que não existe turno para consultar. Ver
 *   `lib/cash-register-mode.ts`, inclusive para o bloqueio que mantém esse modo
 *   desligado por enquanto.
 */
export function useCashRegister(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();

  const {
    data: session,
    isLoading,
    refetch: refetchSession,
  } = useGetCurrentCashRegisterSession({ query: { retry: false, enabled } });

  // Com a consulta desligada a tela não pode ficar esperando: não há sessão a
  // carregar, e prender o PDV num spinner seria o oposto do que o modo pede.
  const loadingSession = enabled && isLoading;

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
    // Sem controle de caixa não há sessão a ressuscitar; ler a cópia só
    // devolveria o turno de quando a loja ainda usava caixa.
    if (!enabled) return;

    let active = true;

    void readCachedCashRegisterSession<CashRegisterSessionDto>()
      .then((stored) => {
        if (active) setCachedSession(stored);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [enabled]);

  // A cópia local acompanha o que o servidor confirmou: a sessão aberta é
  // guardada, e o caixa fechado (ou a ausência de sessão) apaga a cópia para não
  // ressuscitar uma sessão encerrada no próximo recarregamento.
  useEffect(() => {
    if (session === undefined) return;

    void writeCachedCashRegisterSession(session ?? null).catch(() => undefined);
  }, [session]);

  // A cópia local só entra quando a API não respondeu (`undefined`). Um `null` é
  // resposta do servidor — "não há caixa aberto" — e precisa vencer a cópia,
  // senão um caixa já fechado ressuscitaria a cada render.
  const activeSession = session === undefined ? cachedSession : session;
  const sessionId = activeSession?.id ?? null;

  /** A sessão em uso veio da base local porque a API não respondeu. */
  const isSessionFromCache = session === undefined && cachedSession != null;

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

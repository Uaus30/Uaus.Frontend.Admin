import { useCallback, useEffect, useRef } from "react";
import { getPdvPromotions } from "@workspace/api-client-react";
import { readLocalPromotions, toLocalPromotion, writeLocalPromotions } from "@/offline";
import { usePdvStore } from "@/stores/use-pdv-store";

/**
 * Mantém o balcão sabendo quais promoções valem hoje.
 *
 * ## Por que existe uma atualização além do snapshot
 *
 * O snapshot é baixado **uma vez, na abertura do caixa**. A relâmpago é decidida
 * no dia, às vezes no próprio sábado de manhã — sem esta atualização, cadastrar a
 * promoção às 13h exigiria fechar e reabrir o caixa para ela valer no balcão, e
 * quem descobriria seria a fila.
 *
 * ## A base local vem primeiro, sempre
 *
 * A leitura do IndexedDB acontece antes de qualquer requisição, e é ela que vale
 * quando a rede falha. É o que faz uma queda de internet no meio do sábado não
 * mudar preço nenhum: sem rede, vale o que está gravado. A requisição só
 * SUBSTITUI o que está lá quando responde — resposta que não vem não apaga nada.
 *
 * ## Uma lista, dois destinos
 *
 * O que chega da API é gravado na base local **e** publicado no store. A gravação
 * é o que sobrevive ao F5 e à queda de rede; o store é o que o carrinho lê a cada
 * item bipado, sem tocar no banco a cada bipe.
 *
 * @param online A API está respondendo. Offline o hook não tenta a rede — a base
 *   local já foi lida, e a tentativa só gastaria o tempo do `fetch` falhando.
 */

/** De quanto em quanto tempo o balcão relê as promoções da API. */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Idade mínima da lista para a abertura de uma venda disparar releitura.
 *
 * O começo da venda é o único momento em que a lista PRECISA estar certa — é ali
 * que o preço é congelado. Sem a idade mínima, uma fila de sábado com uma venda a
 * cada vinte segundos viraria uma requisição a cada vinte segundos, e a janela da
 * promoção não muda nesse intervalo.
 */
const SALE_START_MAX_AGE_MS = 60 * 1000;

export function usePromotions(online: boolean) {
  const setPromotions = usePdvStore((state) => state.setPromotions);
  const status = usePdvStore((state) => state.status);

  // Evita a corrida entre a leitura local e a resposta da API: a local termina
  // primeiro na maioria das vezes, mas numa base grande (ou num caixa lento) ela
  // pode terminar DEPOIS e sobrescrever a lista mais nova com a mais velha.
  const carregouDaApi = useRef(false);
  const ultimaBusca = useRef(0);

  /**
   * Busca as promoções na API e substitui a lista local por inteiro.
   *
   * Substituição, e não mesclagem, pelo mesmo motivo do snapshot: promoção que
   * sumiu da resposta (excluída, desativada, ou fora da janela de sete dias) tem
   * que sumir do balcão. Mesclar deixaria relâmpago encerrada valendo até alguém
   * fechar o caixa.
   */
  const refresh = useCallback(async () => {
    // Antes da requisição, e não depois: a marca serve para NÃO repetir a busca,
    // e gravá-la só no sucesso deixaria duas tentativas simultâneas passarem.
    ultimaBusca.current = Date.now();

    try {
      const promocoes = (await getPdvPromotions()).map(toLocalPromotion);
      carregouDaApi.current = true;

      await writeLocalPromotions(promocoes);
      setPromotions(promocoes);
    } catch {
      // Silêncio deliberado: promoção é enfeite do preço, não pré-requisito da
      // venda. Um toast vermelho a cada cinco minutos numa loja com internet
      // instável treinaria o operador a ignorar os avisos que importam — e o que
      // está gravado na base local continua valendo.
    }
  }, [setPromotions]);

  // A base local é lida uma vez, na montagem: é o que faz o caixa reaberto sem
  // internet continuar aplicando a relâmpago do dia.
  useEffect(() => {
    void readLocalPromotions().then((promocoes) => {
      if (carregouDaApi.current) return;
      setPromotions(promocoes);
    });
  }, [setPromotions]);

  useEffect(() => {
    if (!online) return;

    void refresh();

    const timer = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [online, refresh]);

  // A venda que começa é o momento em que o preço é congelado; é ali que vale
  // gastar uma requisição para a promoção cadastrada há pouco já aparecer.
  useEffect(() => {
    if (!online || status !== "SELLING") return;
    if (Date.now() - ultimaBusca.current < SALE_START_MAX_AGE_MS) return;

    void refresh();
  }, [online, status, refresh]);

  return { refreshPromotions: refresh };
}

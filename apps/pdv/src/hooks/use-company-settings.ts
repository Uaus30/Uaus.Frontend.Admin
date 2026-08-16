import { useEffect, useState } from "react";
import { STALE_TIME, useGetCompanySettings, type CompanySettingsDto } from "@workspace/api-client-react";
import { readCachedCompanySettings, writeCachedCompanySettings } from "@/offline";
import { useOfflineStore } from "@/stores/use-offline-store";
import {
  DEFAULT_COMPANY_SETTINGS,
  resolveCashRegisterMode,
  type CashRegisterMode,
} from "@/lib/cash-register-mode";

/**
 * useCompanySettings
 *
 * As configurações de operação da loja e o que elas mudam no PDV.
 *
 * A leitura tem três degraus, nesta ordem: o servidor, a cópia na base local, e
 * o padrão. O degrau do meio existe porque a configuração decide se o PDV mostra
 * o diálogo de abertura de caixa — uma decisão que a primeira tela toma, antes
 * de qualquer requisição ter dado certo. Num PDV que abre sem internet (queda de
 * energia com a rede ainda fora), sem a cópia o operador veria o comportamento
 * padrão em vez do da loja dele.
 *
 * A identidade da loja impressa nos cupons (nome, endereço, CNPJ, rodapé) vem
 * nas mesmas configurações e percorre os mesmos degraus: no último, o cupom
 * imprime os valores padrão embutidos (`resolveStoreInfo`, no pacote de cupom).
 *
 * O backend nunca falha nesta leitura — sem a linha no banco ele devolve o
 * padrão —, então o degrau do meio só entra em cena quando a requisição não sai.
 */
export function useCompanySettings(): {
  settings: CompanySettingsDto;
  /** As perguntas do PDV sobre controle de caixa, já respondidas. */
  mode: CashRegisterMode;
  /** As configurações em uso vieram da base local porque a API não respondeu. */
  isFromCache: boolean;
  /**
   * Nenhum dos dois primeiros degraus respondeu ainda: o que está em uso é o
   * PADRÃO, ou seja, um palpite.
   *
   * Quem só imprime a configuração pode ignorar. Quem **decide a tela** a partir
   * dela precisa esperar: o PDV pergunta se a loja tem turno, e o padrão responde
   * "não". Quando a resposta de verdade chega dizendo "sim", a consulta de sessão
   * liga e a tela que já estava montada volta para o spinner — levando junto o
   * cursor do operador. Ver a regra 11 no README da feature.
   */
  isLoading: boolean;
} {
  const online = useOfflineStore((state) => state.online);

  const { data, isLoading: consultandoServidor } = useGetCompanySettings({
    // Sem conexão a requisição só falharia; a cópia local responde por ela.
    query: { enabled: online, retry: false, staleTime: STALE_TIME.catalogo },
  });

  const [cached, setCached] = useState<CompanySettingsDto | null>(null);
  const [cacheLido, setCacheLido] = useState(false);

  useEffect(() => {
    let active = true;

    void readCachedCompanySettings()
      .then((stored) => {
        if (active && stored) setCached(stored);
      })
      .catch(() => undefined)
      // Terminou, com cópia ou sem — inclusive quando falhou. Quem espera por
      // esta leitura é a tela, e um IndexedDB bloqueado não pode deixar o PDV
      // preso num spinner para sempre.
      .finally(() => {
        if (active) setCacheLido(true);
      });

    return () => {
      active = false;
    };
  }, []);

  // A cópia local acompanha o que o servidor confirmou, e nunca é apagada: uma
  // configuração antiga da própria loja é sempre um palpite melhor do que o
  // padrão genérico. Só grava — o estado em memória continua vindo de `data`,
  // que o react-query preserva mesmo com a consulta desligada pela queda.
  useEffect(() => {
    if (!data) return;

    void writeCachedCompanySettings(data).catch(() => undefined);
  }, [data]);

  const settings = data ?? cached ?? DEFAULT_COMPANY_SETTINGS;

  return {
    settings,
    mode: resolveCashRegisterMode(settings),
    isFromCache: !data && cached != null,
    // A resposta do servidor encerra a espera sozinha; sem ela, a espera só
    // acaba quando a leitura da cópia local terminar.
    isLoading: !data && (consultandoServidor || !cacheLido),
  };
}

import { useEffect, useState } from "react";
import { useGetCompanySettings, type CompanySettingsDto } from "@workspace/api-client-react";
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
} {
  const online = useOfflineStore((state) => state.online);

  const { data } = useGetCompanySettings({
    // Sem conexão a requisição só falharia; a cópia local responde por ela.
    query: { enabled: online, retry: false, staleTime: 5 * 60 * 1000 },
  });

  const [cached, setCached] = useState<CompanySettingsDto | null>(null);

  useEffect(() => {
    let active = true;

    void readCachedCompanySettings()
      .then((stored) => {
        if (active && stored) setCached(stored);
      })
      .catch(() => undefined);

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
  };
}

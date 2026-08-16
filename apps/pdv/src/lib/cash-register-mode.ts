import type { CompanySettingsDto } from "@workspace/api-client-react";

/**
 * O que as configurações da empresa mudam no PDV.
 *
 * A loja pode operar **sem controle de caixa** (`usesCashRegister = false`): não
 * há abertura nem fechamento por turno, e o operador vende direto. Traduzir esse
 * booleano nas perguntas que a tela realmente faz — "mostro o diálogo de
 * abertura?", "a venda precisa de sessão?" — é o papel deste módulo, e ele é
 * puro para que cada resposta tenha teste.
 *
 * ---
 *
 * ## Quem decide o quê
 *
 * O servidor tem a palavra final: `PdvService.ResolveSaleSessionAsync` ignora a
 * sessão que o PDV enviar quando a empresa não usa controle de caixa, e exige
 * caixa aberto quando usa. Este módulo só evita que a tela peça ao operador algo
 * que o servidor vai descartar.
 *
 * A **baixa de estoque** nunca exige sessão: é movimento de estoque, não de
 * dinheiro. O servidor a vincula ao turno por rastreio quando a loja usa caixa,
 * e deixa nula quando não usa.
 */

/**
 * Padrão do PDV enquanto o servidor não responde: **sem** controle de caixa.
 *
 * Precisa ser o mesmo padrão do backend (`CompanySettingsService.Default`) e o
 * mesmo que o script de schema semeia. Se os três divergirem, a loja vê
 * comportamentos diferentes conforme a leitura da configuração ter dado certo ou
 * não — e o pior caso é o PDV exigir abertura de caixa numa loja que não usa,
 * offline, sem ninguém para destravar.
 */
export const DEFAULT_COMPANY_SETTINGS: CompanySettingsDto = { usesCashRegister: false };

/** As perguntas que a tela faz sobre controle de caixa, já respondidas. */
export interface CashRegisterMode {
  /** A loja declarou que usa controle de caixa (abertura e fechamento por turno). */
  usesCashRegister: boolean;
  /**
   * O PDV bloqueia a tela até haver sessão aberta (diálogo de abertura, botão de
   * fechamento, relatório do turno).
   */
  requiresOpenSession: boolean;
  /**
   * A venda precisa de uma sessão de caixa para ser registrada.
   *
   * Acompanha `usesCashRegister`: o servidor exige sessão aberta quando a loja
   * controla caixa, e ignora a sessão quando não controla.
   */
  saleRequiresSession: boolean;
  /**
   * A baixa de estoque precisa de sessão.
   *
   * Nunca: é movimento de estoque, não de dinheiro. O servidor vincula o turno
   * por rastreio quando a loja usa caixa, e deixa nulo quando não usa — nos dois
   * casos sem exigir caixa aberto.
   */
  writeOffRequiresSession: false;
}

/**
 * Traduz as configurações da empresa no que o PDV precisa decidir.
 *
 * @param settings Configurações vindas da API ou da base local; `null` cai no
 *   padrão, que é o mesmo do backend — uma loja sem a configuração gravada opera
 *   do jeito de sempre.
 */
export function resolveCashRegisterMode(settings: CompanySettingsDto | null | undefined): CashRegisterMode {
  const usesCashRegister = settings?.usesCashRegister ?? DEFAULT_COMPANY_SETTINGS.usesCashRegister;

  return {
    usesCashRegister,
    // As três perguntas têm a mesma resposta hoje. Continuam separadas porque são
    // perguntas diferentes: se um dia a venda exigir sessão sem a tela bloquear
    // (ou o contrário), o ponto de mudança é este, e não a tela.
    requiresOpenSession: usesCashRegister,
    saleRequiresSession: usesCashRegister,
    writeOffRequiresSession: false,
  };
}

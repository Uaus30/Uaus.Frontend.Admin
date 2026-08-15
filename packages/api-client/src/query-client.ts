import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";

/**
 * Política de cache do React Query, num lugar só.
 *
 * Antes os dois apps declaravam o mesmo `new QueryClient({...})` à mão e as
 * telas repetiam "cinco minutos" em três grafias diferentes — `5 * 60 * 1000`,
 * `5 * 60_000` e uma constante local. Número repetido não fica repetido por
 * muito tempo: basta alguém ajustar uma das cópias para o catálogo passar a
 * envelhecer diferente dependendo da tela que o carregou.
 */

/**
 * Por quanto tempo um dado continua "fresco", nomeado pelo que ele É.
 *
 * A escala é escolhida pela natureza do dado, não pelo gosto de quem escreve a
 * query: quem decide entre `operacao` e `catalogo` está respondendo "isto muda
 * sozinho enquanto a tela está aberta?", que é a pergunta certa. Um número solto
 * não faz ninguém se perguntar nada.
 */
export const STALE_TIME = {
  /**
   * Dado que muda sozinho: venda, sessão de caixa, fila de sincronização,
   * estoque. Meio minuto é o limite do que dá para mostrar sem arriscar decisão
   * sobre número velho.
   */
  operacao: 30_000,

  /**
   * Catálogo: departamento, categoria, etiqueta, fornecedor, forma de pagamento.
   * Só muda quando alguém edita, e quem edita invalida a chave — o refetch por
   * tempo aqui é rede de segurança, não o caminho normal.
   */
  catalogo: 5 * 60_000,

  /**
   * Praticamente imutável dentro de uma sessão: enums do backend, dados da
   * empresa, identidade do operador logado.
   */
  referencia: 30 * 60_000,
} as const;

/**
 * Cria o QueryClient dos apps com a política padrão já aplicada.
 *
 * **Por que `retry: false`.** O padrão do React Query são 3 tentativas com
 * espera crescente, e ele está errado para os dois apps aqui, por motivos
 * diferentes. No PDV, quem responde quando a rede cai é a base local do
 * IndexedDB: insistir na rede só atrasa o caminho offline, que é o caminho que
 * funciona. No admin, as telas são de operação — cada tentativa extra é o
 * operador olhando um spinner sem saber se salvou, e um erro que aparece rápido
 * e diz o que houve é melhor que um sucesso que talvez venha em oito segundos.
 *
 * O custo é assumido: uma oscilação de rede vira erro na tela em vez de se
 * resolver sozinha. Trocar isto por um retry curto é uma decisão de produto, e
 * precisa ser tomada com a API de pé para medir — não no escuro.
 *
 * @param config Ajustes por app, mesclados sobre o padrão.
 */
export function createQueryClient(config?: QueryClientConfig): QueryClient {
  return new QueryClient({
    ...config,
    defaultOptions: {
      ...config?.defaultOptions,
      queries: {
        retry: false,
        staleTime: STALE_TIME.operacao,
        ...config?.defaultOptions?.queries,
      },
    },
  });
}

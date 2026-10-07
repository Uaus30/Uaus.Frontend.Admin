import { toDateKey } from "@workspace/core";

/** O que o aviso de base velha precisa saber. */
export interface StaleLocalDataInput {
  /** A API está respondendo. Com internet não há aviso: o PDV lê o que é de hoje. */
  online: boolean;
  /** A sessão de caixa em uso veio da cópia local (a API não respondeu). */
  isSessionFromCache: boolean;
  /** Abertura da sessão em uso, como a API devolve (hora de Brasília, sem fuso). */
  sessionOpenedAt: string | null;
  /** Quando a base local (produtos, preços, estoque) foi baixada, em ISO. */
  snapshotDownloadedAt: string | null;
  now: Date;
}

/** Instante com fuso explícito: `Z` ou `±hh:mm` no fim. */
const HAS_TIMEZONE = /(?:Z|[+-]\d{2}:?\d{2})$/;

/**
 * O dia (AAAA-MM-DD) de um instante. A hora da API vem sem fuso e já é a de
 * Brasília — o dia é o que está escrito, em qualquer aparelho. Com fuso (a data
 * de download da base, gravada pelo próprio PDV), vale o dia do aparelho.
 */
function dayOf(value: string): string {
  return HAS_TIMEZONE.test(value) ? toDateKey(new Date(value)) : value.slice(0, 10);
}

/**
 * O dia mais antigo entre a sessão de caixa e a base local deste aparelho,
 * quando ele está sem internet e esse dia não é hoje — em "dd/mm/aaaa". `null`
 * quando não há o que avisar.
 *
 * É o risco do celular de contingência (07/10/2026): a cópia local da sessão não
 * tem validade. O celular que não abriu o PDV com internet desde ontem, sem
 * internet hoje, vende na sessão de ontem — que o computador já fechou — e toda
 * venda é recusada quando a fila sobe, com preço e estoque de ontem. Decisão do
 * dono: **só avisar**, sem bloquear a venda.
 */
export function staleLocalDataSince(input: StaleLocalDataInput): string | null {
  if (input.online) return null;

  const days = [
    input.isSessionFromCache && input.sessionOpenedAt ? dayOf(input.sessionOpenedAt) : null,
    input.snapshotDownloadedAt ? dayOf(input.snapshotDownloadedAt) : null,
  ].filter((day): day is string => day !== null);

  const today = toDateKey(input.now);
  const oldest = days.filter((day) => day < today).sort()[0];
  if (!oldest) return null;

  const [year, month, day] = oldest.split("-");
  return `${day}/${month}/${year}`;
}

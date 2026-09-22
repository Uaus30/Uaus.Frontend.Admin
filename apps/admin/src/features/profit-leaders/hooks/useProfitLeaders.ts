import * as React from "react";
import {
  PROFIT_LEADERS_PERIOD,
  useGetProfitLeaders,
  type ProfitArchetypeName,
  type ProfitLeadersPeriod,
} from "@workspace/api-client-react";

/** Intervalo escolhido à mão, em datas de calendário (aaaa-mm-dd). */
export type CustomRange = { startDate: string; endDate: string };

/**
 * Estado da tela "O que trouxe lucro".
 *
 * <b>O período vai ao SERVIDOR</b>: trocar de preset refaz o corte inteiro, e o
 * conjunto de líderes muda com ele — recortar no cliente devolveria as linhas de
 * um período com o corte de outro. Já a busca e o filtro de arquétipo são
 * LOCAIS, sobre as poucas dezenas já carregadas: pedir ao servidor traria outro
 * conjunto e trocaria a lista debaixo de quem está lendo.
 *
 * <b>Filtrar não reordena nem renumera.</b> A posição é do corte inteiro; uma
 * linha filtrada continua sendo a 12ª, porque é isso que ela é.
 */
export function useProfitLeaders() {
  const [period, setPeriod] = React.useState<ProfitLeadersPeriod>(PROFIT_LEADERS_PERIOD.Last90Days);
  const [custom, setCustom] = React.useState<CustomRange | null>(null);
  const [search, setSearch] = React.useState("");
  const [archetype, setArchetype] = React.useState<ProfitArchetypeName | null>(null);

  /**
   * Muda a cada limpeza, para o calendário remontar.
   *
   * Mesma armadilha de "O que mudou": o "X" em modo preset chama `setCustom(null)`
   * com `custom` JÁ nulo, o React aborta o re-render, a `key` não muda e o
   * gatilho fica anunciando "Selecionar período" sobre uma consulta que não
   * mudou.
   */
  const [resetToken, setResetToken] = React.useState(0);

  const emModoCustom = period === PROFIT_LEADERS_PERIOD.Custom;

  const query = useGetProfitLeaders({
    period,
    startDate: emModoCustom ? custom?.startDate : undefined,
    endDate: emModoCustom ? custom?.endDate : undefined,
  });

  const report = query.data;

  /** As três primeiras posições — o pódio. */
  const podium = React.useMemo(() => (report?.leaders ?? []).slice(0, 3), [report]);

  /** Quantos líderes há de cada arquétipo, para as pastilhas de filtro. */
  const counts = React.useMemo(() => {
    const mapa = new Map<ProfitArchetypeName, number>();
    for (const lider of report?.leaders ?? [])
      mapa.set(lider.archetype, (mapa.get(lider.archetype) ?? 0) + 1);
    return mapa;
  }, [report]);

  const leaders = React.useMemo(() => {
    const linhas = report?.leaders ?? [];
    const termo = search.trim().toLowerCase();

    return linhas.filter((linha) => {
      if (archetype && linha.archetype !== archetype) return false;
      if (!termo) return true;

      return (
        linha.productName.toLowerCase().includes(termo) ||
        linha.barcode.toLowerCase().includes(termo) ||
        (linha.categoryName ?? "").toLowerCase().includes(termo)
      );
    });
  }, [report, search, archetype]);

  return {
    period,
    custom,
    resetToken,
    handleSelectPeriod: (value: ProfitLeadersPeriod) => {
      setPeriod(value);

      if (value !== PROFIT_LEADERS_PERIOD.Custom) {
        setCustom(null);
      } else if (!custom && report) {
        // Escolher "Personalizado" SEMEIA o intervalo com o que está na tela.
        //
        // Sem isso a consulta sai com `period=Custom` e sem datas, o servidor
        // devolve o intervalo padrão, e a tela troca de conteúdo no instante em
        // que o usuário abriu o seletor — antes de ele escolher coisa alguma. É
        // uma ida ao servidor jogada fora e um susto de graça; semeando, o
        // calendário abre já preenchido com o período que ele estava vendo.
        setCustom({ startDate: report.startDate.slice(0, 10), endDate: report.endDate.slice(0, 10) });
      }

      setResetToken((atual) => atual + 1);
    },
    handleApplyCustom: (proximo: CustomRange) => {
      setCustom(proximo);
      setPeriod(PROFIT_LEADERS_PERIOD.Custom);
      setResetToken((atual) => atual + 1);
    },
    handleClearCustom: () => {
      setCustom(null);
      setResetToken((atual) => atual + 1);
    },

    search,
    setSearch,
    archetype,
    /** Clicar na pastilha já ativa desliga o filtro. */
    toggleArchetype: (valor: ProfitArchetypeName) =>
      setArchetype((atual) => (atual === valor ? null : valor)),
    counts,

    report,
    podium,
    leaders,
    isFiltered: search.trim().length > 0 || archetype !== null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

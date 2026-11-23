import { useMemo, useState } from "react";
import { useGetFinancialClosingNext, useGetFinancialClosings } from "@workspace/api-client-react";
import { parseMonthKey } from "@workspace/core";
import { buildMonthOptions, buildYearOptions, closedMonthsOf, lastEndedMonth } from "../month-selection";

/** Teto da consulta que descobre os meses já fechados de um ano. */
const CLOSED_MONTHS_LIMIT = 200;

/**
 * A competência do novo fechamento: ano, mês e o estado de cada mês no select.
 *
 * O mês sugerido é o que `GET /FinancialClosings/next` aponta — com a corrente
 * de saldos, é o único que pode ser fechado —, e ele é escolhido sozinho uma
 * vez por abertura do diálogo, quando a resposta chega. Se a consulta falhar, a
 * sugestão cai no último mês encerrado e o select volta à regra antiga: o
 * servidor recusa na confirmação o que estiver fora da corrente.
 *
 * @param open O diálogo está aberto — fechado, nada é consultado.
 */
export function useClosingCompetence(open: boolean) {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState<number | null>(null);
  // A sugestão já foi aplicada nesta abertura? Sem isso, trocar o ano (que
  // limpa o mês) traria a sugestão de volta por cima da escolha da pessoa.
  const [suggestionApplied, setSuggestionApplied] = useState(false);

  const nextQuery = useGetFinancialClosingNext({ query: { enabled: open } });
  const next = nextQuery.data;
  const nextCompetence = useMemo(() => parseMonthKey(next?.month), [next?.month]);

  // Fechamentos que podem tocar o ano escolhido, para travar os meses já
  // fechados. A janela começa no ano anterior porque os fechamentos antigos são
  // de período livre: um que comece em dezembro pode invadir janeiro daqui.
  const { data: yearClosings, isLoading: isLoadingClosings } = useGetFinancialClosings(
    { startDate: `${year - 1}-01-01`, endDate: `${year}-12-31`, page: 1, limit: CLOSED_MONTHS_LIMIT },
    { query: { enabled: open } },
  );

  const closedMonths = useMemo(
    () => closedMonthsOf(year, yearClosings?.data ?? []),
    [year, yearClosings?.data],
  );
  const monthOptions = useMemo(
    () => buildMonthOptions(year, closedMonths, new Date(), nextCompetence),
    [year, closedMonths, nextCompetence],
  );
  const yearOptions = useMemo(() => buildYearOptions(), []);

  // Ajuste durante o render, e não efeito: a condição se desfaz sozinha depois
  // dele (`suggestionApplied`), e o mês aparece já no primeiro quadro. Espera a
  // resposta FRESCA: logo depois de confirmar um fechamento o `next` em cache é
  // o do mês que acabou de fechar, e sugeri-lo deixaria o diálogo num mês travado.
  if (open && !suggestionApplied && !nextQuery.isFetching && (nextCompetence !== null || nextQuery.isError)) {
    const suggestion = nextCompetence ?? lastEndedMonth();
    setSuggestionApplied(true);
    setYear(suggestion.year);
    setMonth(suggestion.month);
  }

  /** Zera para a próxima abertura: ano corrente, sem mês, sugestão pendente. */
  function reset() {
    setYear(new Date().getFullYear());
    setMonth(null);
    setSuggestionApplied(false);
  }

  /** Troca o ano; o mês volta a ficar em branco porque a disponibilidade é outra. */
  function handleYearChange(newYear: number) {
    setYear(newYear);
    setMonth(null);
  }

  /** O atalho "Mês sugerido": volta ao mês que aguarda fechamento. */
  function applySuggested() {
    const suggestion = nextCompetence ?? lastEndedMonth();
    setYear(suggestion.year);
    setMonth(suggestion.month);
  }

  return {
    year,
    month,
    yearOptions,
    monthOptions,
    selected: monthOptions.find((option) => option.month === month) ?? null,
    isLoadingMonths: isLoadingClosings || nextQuery.isLoading,
    next,
    handleYearChange,
    handleMonthChange: setMonth,
    applySuggested,
    reset,
  };
}

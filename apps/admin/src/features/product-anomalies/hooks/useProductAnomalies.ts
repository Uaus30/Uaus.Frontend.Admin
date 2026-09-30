import * as React from "react";
import { normalizeSearchText } from "@workspace/core";
import {
  useGetProductAnomalies,
  type ProductAnomalyRowDto,
  type ProductAnomalyTypeName,
} from "@workspace/api-client-react";
import { isSingleUnitIdle } from "../lib/anomalies";

/**
 * Estado da tela "Anomalias".
 *
 * <b>A varredura é sempre do catálogo inteiro</b> e não tem parâmetro: filtro por
 * tipo e busca são LOCAIS, sobre a lista já carregada (cerca de 120 cadastros em
 * produção). Pedir ao servidor traria outro conjunto e trocaria a lista debaixo
 * de quem está corrigindo.
 *
 * <b>Voltar para a aba recarrega.</b> A correção acontece no cadastro, aberto em
 * nova aba; quem volta quer ver se a anomalia sumiu. `refetchOnWindowFocus` já é
 * o padrão do React Query, e fica escrito aqui porque é requisito da tela, não
 * acaso — e só dispara com o dado mais velho que o `staleTime` do admin (30 s).
 * O botão de recarregar continua para o "agora".
 *
 * <b>"Ignorar saldo menor que 2"</b> (pedido do dono, 30/09/2026) esconde as
 * etiquetas de produto parado em variação com uma unidade só — livro de título
 * único, peça única — e some com a linha que ficar sem etiqueta. É local, como o
 * filtro: o servidor manda tudo, e as pastilhas se recontam aqui sobre o que
 * sobrou. Ligado por padrão: é o caso comum da loja.
 */
export function useProductAnomalies() {
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState<ProductAnomalyTypeName | null>(null);
  const [ignoreSingleUnits, setIgnoreSingleUnits] = React.useState(true);

  const query = useGetProductAnomalies({ query: { refetchOnWindowFocus: true } });
  const report = query.data;

  /** A lista com o interruptor aplicado — é sobre ela que as pastilhas, o total e a busca trabalham. */
  const base = React.useMemo<ProductAnomalyRowDto[]>(() => {
    const linhas = report?.items ?? [];
    if (!ignoreSingleUnits) return linhas;

    return linhas.flatMap((linha) => {
      const anomalies = linha.anomalies.filter((anomalia) => !isSingleUnitIdle(anomalia));
      if (anomalies.length === 0) return [];
      return anomalies.length === linha.anomalies.length ? [linha] : [{ ...linha, anomalies }];
    });
  }, [report, ignoreSingleUnits]);

  /** Cadastros por tipo, para as pastilhas: conta grupos, não variações, como o servidor. */
  const counts = React.useMemo(() => {
    const mapa = new Map<ProductAnomalyTypeName, number>();
    for (const linha of base)
      for (const tipo of new Set(linha.anomalies.map((anomalia) => anomalia.type)))
        mapa.set(tipo, (mapa.get(tipo) ?? 0) + 1);
    return mapa;
  }, [base]);

  const items = React.useMemo(() => {
    const linhas = base;
    const termo = normalizeSearchText(search);

    return linhas.filter((linha) => {
      if (type && !linha.anomalies.some((anomalia) => anomalia.type === type)) return false;
      if (!termo) return true;

      const textos = [
        linha.name,
        linha.categoryName ?? "",
        String(linha.productGroupId),
        ...linha.anomalies.map((anomalia) => anomalia.productName ?? ""),
      ];
      return textos.some((texto) => normalizeSearchText(texto).includes(termo));
    });
  }, [base, search, type]);

  return {
    report,
    items,
    counts,
    /** Cadastros na lista inteira, antes de filtro e busca (mas depois do interruptor). */
    total: base.length,

    ignoreSingleUnits,
    setIgnoreSingleUnits,

    search,
    setSearch,
    type,
    /** Clicar na pastilha já ativa desliga o filtro. */
    toggleType: (valor: ProductAnomalyTypeName) => setType((atual) => (atual === valor ? null : valor)),
    clearType: () => setType(null),
    isFiltered: search.trim().length > 0 || type !== null,

    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

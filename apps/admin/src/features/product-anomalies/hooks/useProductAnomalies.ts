import * as React from "react";
import { normalizeSearchText } from "@workspace/core";
import { useGetProductAnomalies, type ProductAnomalyTypeName } from "@workspace/api-client-react";

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
 */
export function useProductAnomalies() {
  const [search, setSearch] = React.useState("");
  const [type, setType] = React.useState<ProductAnomalyTypeName | null>(null);

  const query = useGetProductAnomalies({ query: { refetchOnWindowFocus: true } });
  const report = query.data;

  /** Cadastros por tipo, para as pastilhas. Vem pronto do servidor: conta grupos, não variações. */
  const counts = React.useMemo(() => {
    const mapa = new Map<ProductAnomalyTypeName, number>();
    for (const contagem of report?.counts ?? []) mapa.set(contagem.type, contagem.groups);
    return mapa;
  }, [report]);

  const items = React.useMemo(() => {
    const linhas = report?.items ?? [];
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
  }, [report, search, type]);

  return {
    report,
    items,
    counts,
    /** Cadastros na lista inteira, antes de filtro e busca. */
    total: report?.items.length ?? 0,

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

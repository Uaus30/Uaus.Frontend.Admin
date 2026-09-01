import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "wouter";
import { useDebounce } from "@workspace/ui";
import { CATALOG_PARAMS, catalogSearchParams, type CatalogFilters } from "@/routes";

export interface CatalogFiltersState {
  /** O que vale para a consulta — sempre o que está na URL. */
  filters: CatalogFilters;
  /** Texto do campo de busca, com resposta imediata ao digitar. */
  searchInput: string;
  setSearchInput: (value: string) => void;
  /** O que foi digitado ainda não virou URL (debounce em curso). */
  isSearchPending: boolean;
  hasFilters: boolean;
}

/**
 * Id de filtro vindo da URL. Lixo (`?departamento=abc`, zero, negativo) vira
 * ausência, não erro de tela: query string é digitada por gente e colada de
 * link velho, e derrubar a vitrine por causa disso seria trocar um filtro
 * ignorado por uma página quebrada.
 */
function parseFilterId(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : undefined;
}

/**
 * Filtros da vitrine, guardados na URL.
 *
 * A URL é o estado — não `useState` — porque é o que faz o filtro sobreviver a
 * três gestos que o visitante dá o tempo todo: compartilhar o link, recarregar
 * a página e voltar do detalhe do produto. Com estado local, os três perdem o
 * filtro, e o último é o pior: quem abre um produto e volta espera a lista
 * exatamente como deixou.
 *
 * Quem NAVEGA entre filtros são links (`catalogPath`), não este hook: link é
 * rastreável pelo buscador, abre em aba nova e empilha histórico sozinho. Aqui
 * mora só a busca, que precisa de debounce e grava com REPLACE — cada letra
 * digitada virando entrada de histórico deixaria o botão Voltar intransitável.
 */
export function useCatalogFilters(): CatalogFiltersState {
  const [params, setSearchParams] = useSearchParams();

  const departmentId = parseFilterId(params.get(CATALOG_PARAMS.department));
  const categoryId = parseFilterId(params.get(CATALOG_PARAMS.category));
  const search = (params.get(CATALOG_PARAMS.search) ?? "").trim();

  const [searchInput, setSearchInput] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  const debouncedInput = useDebounce(searchInput);

  // A URL mudou por fora (Voltar do navegador, trilha do detalhe, chip de
  // limpar): o campo adota o valor novo. Ajuste DURANTE o render, o padrão do
  // React para derivar estado de prop — um efeito renderizaria um frame com o
  // texto antigo. A comparação com o `debouncedInput` distingue mudança externa
  // da nossa própria gravação: sem ela, escrever "can" enquanto o visitante já
  // digitou "cane" devolveria o campo para "can".
  if (syncedSearch !== search) {
    setSyncedSearch(search);
    if (debouncedInput.trim() !== search) setSearchInput(search);
  }

  const writeSearch = useCallback(
    (next: CatalogFilters) => {
      setSearchParams(catalogSearchParams(next), { replace: true });
    },
    [setSearchParams],
  );

  useEffect(() => {
    const trimmed = debouncedInput.trim();

    // O debounce ainda não alcançou o que está no campo: gravar agora
    // ressuscitaria texto que o visitante já apagou. É exatamente o que
    // acontecia ao clicar em "Limpar filtros" com uma busca em voo — a URL
    // limpava e a busca voltava sozinha meio segundo depois.
    if (trimmed !== searchInput.trim()) return;
    if (trimmed === search) return;

    writeSearch({ departmentId, categoryId, search: trimmed });
  }, [debouncedInput, searchInput, search, departmentId, categoryId, writeSearch]);

  return {
    filters: { departmentId, categoryId, search: search || undefined },
    searchInput,
    setSearchInput,
    isSearchPending: searchInput.trim() !== search,
    hasFilters: departmentId !== undefined || categoryId !== undefined || search.length > 0,
  };
}

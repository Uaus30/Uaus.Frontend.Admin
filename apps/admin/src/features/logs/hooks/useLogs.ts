import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetLogs } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { getEnumOptions } from "@/services/core";
import { subDays, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "../types";

export const DEFAULT_DATE_RANGE: DateRange = {
  from: startOfDay(subDays(new Date(), 7)),
  to: endOfDay(new Date()),
};

/**
 * Hook customizado que gerencia a busca, paginação, filtros e lógica de listagem de Logs do Sistema.
 */
export function useLogs() {
  const { toast } = useToast();

  // --- Draft state (editado pelo usuário) ---
  const [draftSearch, setDraftSearch] = useState("");
  const [draftType, setDraftType] = useState<string>("all");
  const [draftDateRange, setDraftDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);

  // --- Applied state (usado na query de API) ---
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedType, setAppliedType] = useState<string>("all");
  const [appliedDateRange, setAppliedDateRange] = useState<DateRange | undefined>(DEFAULT_DATE_RANGE);

  const [page, setPage] = useState(1);
  const limit = 25;

  // Consulta de enums de tipo de log
  const { data: logTypeOptions = [] } = useQuery({
    queryKey: ["log-type-options"],
    queryFn: () => getEnumOptions("/Logs/enums/log-type"),
  });

  const selectableLogTypeOptions = useMemo(
    () => logTypeOptions.filter((item) => item.allowSelect),
    [logTypeOptions],
  );

  const startDateISO = appliedDateRange?.from
    ? startOfDay(appliedDateRange.from).toISOString()
    : undefined;
  const endDateISO = appliedDateRange?.to
    ? endOfDay(appliedDateRange.to).toISOString()
    : undefined;

  // Consulta paginada dos logs
  const { data, isLoading, isError, error } = useGetLogs({
    search: appliedSearch || undefined,
    type: appliedType !== "all" ? appliedType : undefined,
    startDate: startDateISO,
    endDate: endDateISO,
    page,
    limit,
  });

  // Exibe erro na busca de logs
  useEffect(() => {
    if (isError && error) {
      toast({
        title: "Erro ao carregar logs",
        description: error.message || "Não foi possível conectar com o servidor.",
        variant: "destructive",
      });
    }
  }, [isError, error, toast]);

  const logsList = data?.data || [];

  /**
   * Aplica os filtros ativos (draft) à consulta oficial (applied) e reseta a página para 1.
   */
  function handleSearch() {
    setAppliedSearch(draftSearch);
    setAppliedType(draftType);
    setAppliedDateRange(draftDateRange);
    setPage(1);
  }

  /**
   * Captura o pressionamento da tecla Enter no input de busca para disparar a pesquisa.
   */
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSearch();
    }
  }

  return {
    draftSearch,
    setDraftSearch,
    draftType,
    setDraftType,
    draftDateRange,
    setDraftDateRange,
    appliedSearch,
    appliedType,
    appliedDateRange,
    page,
    setPage,
    limit,
    selectableLogTypeOptions,
    data,
    isLoading,
    logsList,
    handleSearch,
    handleKeyDown,
  };
}

/**
 * Formata strings de data de forma legível (DD/MM/AAAA HH:MM:SS) em pt-BR.
 */
export function formatDateTime(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    const date = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
    const time = new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d);
    return `${date} ${time}`;
  } catch {
    return dateStr;
  }
}

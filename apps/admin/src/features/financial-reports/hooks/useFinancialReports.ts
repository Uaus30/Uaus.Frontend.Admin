import { useEffect, useState } from "react";
import { format, startOfMonth } from "date-fns";
import { useGetFinancialReportSummary } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { describeApiError } from "@/lib/api-error";
import type { FinancialReportPeriodFilter } from "../types";

/** Formato das datas que trafegam como string nos filtros (padrão da casa). */
const DATE_PARAM_FORMAT = "yyyy-MM-dd";

/**
 * Período padrão do relatório: primeiro dia do mês atual até hoje.
 *
 * O mês corrente é o recorte que o dono da loja acompanha no dia a dia; o
 * fechamento oficial (feature financial-closings) é quem trabalha com mês cheio.
 */
export function defaultReportPeriod(): FinancialReportPeriodFilter {
  const today = new Date();
  return {
    startDate: format(startOfMonth(today), DATE_PARAM_FORMAT),
    endDate: format(today, DATE_PARAM_FORMAT),
  };
}

/**
 * useFinancialReports
 *
 * Hook controlador da tela de relatórios financeiros — somente leitura.
 *
 * O período vive aqui como string `yyyy-MM-dd` (padrão useSales/SalesTable); a
 * conversão para `Date` do calendário fica na borda, dentro da página. O resumo
 * é uma PRÉVIA calculada ao vivo pelo backend: nada é persistido por esta tela.
 */
export function useFinancialReports() {
  const { toast } = useToast();

  const [startDate, setStartDate] = useState(() => defaultReportPeriod().startDate);
  const [endDate, setEndDate] = useState(() => defaultReportPeriod().endDate);

  const {
    data: summary,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useGetFinancialReportSummary({
    // Filtro limpo envia undefined — o backend assume os últimos 30 dias.
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  // Notifica falhas da consulta com a mensagem do backend (datas inválidas etc.).
  useEffect(() => {
    if (!isError || !error) return;
    toast({
      title: "Erro ao carregar o relatório financeiro",
      description: describeApiError(error),
      variant: "destructive",
    });
  }, [isError, error, toast]);

  return {
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    summary,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  };
}

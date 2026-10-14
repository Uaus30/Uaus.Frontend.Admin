import { useState } from "react";
import { useToast } from "@workspace/ui";
import { describeApiError, toDateKey } from "@workspace/core";
import { getLowStockPage, type LowStockParams } from "@workspace/api-client-react";
import { exportLowStockToXlsx } from "../lib/export-low-stock";

/** Teto de linhas que a exportação baixa de uma vez. */
export const EXPORT_PAGE_SIZE = 1000;

export interface LowStockExport {
  /**
   * Baixa a lista inteira com os filtros da tela e gera o XLSX
   * `<fileBaseName>-<data>.xlsx`, na aba `sheetName`.
   */
  exportToXlsx: (params: LowStockParams, fileBaseName: string, sheetName?: string) => Promise<void>;
  isExporting: boolean;
}

/**
 * A exportação das duas telas da feature — o relatório de estoque baixo e a
 * Lista de Compras (14/10/2026).
 *
 * **Refaz a consulta** com os filtros da tela (até {@link EXPORT_PAGE_SIZE}
 * linhas), em vez de usar a página em memória: ninguém exporta um relatório
 * para receber as vinte linhas da página corrente. Mora num hook só porque a
 * Lista de Compras repetiria o ciclo inteiro — consulta, planilha e os três
 * avisos —, e os avisos divergiriam na primeira mudança de texto.
 */
export function useLowStockExport(): LowStockExport {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  async function exportToXlsx(params: LowStockParams, fileBaseName: string, sheetName?: string) {
    setIsExporting(true);
    try {
      const result = await getLowStockPage({ ...params, page: 1, limit: EXPORT_PAGE_SIZE });

      const items = result.data;
      if (items.length === 0) {
        toast({
          title: "Nada para exportar",
          description: "Nenhum produto corresponde aos filtros desta tela.",
          variant: "warning",
        });
        return;
      }

      await exportLowStockToXlsx(items, `${fileBaseName}-${toDateKey(new Date())}.xlsx`, sheetName);
      toast({ title: "Planilha gerada", description: `${items.length} produto(s) exportado(s).` });
    } catch (error) {
      toast({
        title: "Erro ao exportar",
        description: describeApiError(error, "Tente novamente."),
        error,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }

  return { exportToXlsx, isExporting };
}

import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { InventoryCountResultDto } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { describeApiError } from "@workspace/core";
import {
  applyInventorySheet,
  canApplyInventoryCount,
  exportInventorySheet,
  previewInventorySheet,
  validateInventoryFile,
} from "@/services/inventory-count.service";

/**
 * useInventoryCount
 *
 * Orquestra o ciclo da contagem: exportar a planilha, conferir a prévia e
 * aplicar.
 *
 * A prévia é obrigatória por decisão de produto — a aplicação altera muitos
 * produtos de uma vez e não tem desfazer em lote, então o botão de aplicar só
 * existe depois que o dono viu o impacto. O estado `result` distingue os dois
 * momentos por `inventoryImportId`: nulo é prévia, preenchido é o que já foi
 * aplicado.
 */
export function useInventoryCount() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<InventoryCountResultDto | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  /** A prévia já foi aplicada — o resultado na tela é histórico, não projeção. */
  const isApplied = result?.inventoryImportId != null;

  /** Baixa a planilha com os produtos vendáveis. */
  const exportSheet = useCallback(async () => {
    setIsExporting(true);
    try {
      const fileName = await exportInventorySheet();
      toast({
        title: "Planilha gerada",
        description: `${fileName} — preencha a coluna "contagem" e importe de volta.`,
      });
    } catch (error) {
      toast({
        title: "Não foi possível gerar a planilha",
        description: describeApiError(error),
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  }, [toast]);

  /**
   * Escolhe o arquivo e já calcula a prévia.
   *
   * Escolher e conferir num passo só: separar em dois cliques faria o operador
   * achar que já importou ao escolher o arquivo.
   */
  const selectFile = useCallback(
    async (selected: File | null) => {
      setResult(null);
      setFile(selected);

      const problem = validateInventoryFile(selected);
      if (problem) {
        if (selected) {
          toast({ title: "Arquivo inválido", description: problem, variant: "destructive" });
        }
        return;
      }

      setIsAnalyzing(true);
      try {
        setResult(await previewInventorySheet(selected!));
      } catch (error) {
        setFile(null);
        toast({
          title: "Não foi possível ler a planilha",
          description: describeApiError(error),
          variant: "destructive",
        });
      } finally {
        setIsAnalyzing(false);
      }
    },
    [toast],
  );

  /** Aplica a contagem: baixa as faltas e dá entrada nas sobras. */
  const apply = useCallback(async () => {
    if (!file || !canApplyInventoryCount(result)) return;

    setIsApplying(true);
    try {
      const applied = await applyInventorySheet(file);
      setResult(applied);

      // A contagem mexe no saldo de muitos produtos de uma vez: produtos,
      // inventário e baixas passam a mostrar números diferentes.
      await queryClient.invalidateQueries();

      toast({
        title: "Contagem aplicada",
        description: applied
          ? `${applied.shortages.length} falta(s) e ${applied.surpluses.length} sobra(s) corrigidas.`
          : "Estoque atualizado.",
        className: "bg-emerald-500 text-white border-none",
      });
    } catch (error) {
      toast({
        title: "Não foi possível aplicar a contagem",
        description: describeApiError(error),
        variant: "destructive",
        duration: 8000,
      });
    } finally {
      setIsApplying(false);
    }
  }, [file, result, queryClient, toast]);

  /** Limpa a tela para uma nova contagem. */
  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
  }, []);

  return {
    file,
    result,
    isExporting,
    isAnalyzing,
    isApplying,
    isApplied,
    canApply: canApplyInventoryCount(result) && !isApplied,
    exportSheet,
    selectFile,
    apply,
    reset,
  };
}

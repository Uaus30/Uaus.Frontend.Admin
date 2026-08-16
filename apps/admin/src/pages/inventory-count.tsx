import { ClipboardCheck, Loader2, RotateCcw } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@workspace/ui";
import { useInventoryCount } from "@/features/inventory-count/hooks/useInventoryCount";
import { InventoryCountSteps } from "@/features/inventory-count/components/InventoryCountSteps";
import { InventoryCountResult } from "@/features/inventory-count/components/InventoryCountResult";

/**
 * Página de Contagem de Estoque.
 *
 * Liga os componentes ao `useInventoryCount`; nenhuma regra mora aqui.
 */
export default function InventoryCount() {
  const {
    file,
    result,
    isExporting,
    isAnalyzing,
    isApplying,
    isApplied,
    canApply,
    exportSheet,
    selectFile,
    apply,
    reset,
  } = useInventoryCount();

  return (
    <AppLayout>
      <div className="flex flex-col gap-6">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-primary" />
            <h1 className="font-display text-3xl font-bold text-foreground">Contagem de Estoque</h1>
          </div>
          <p className="mt-1 text-muted-foreground">
            Confira o estoque físico por planilha. O que faltar vira baixa; o que sobrar, entrada de ajuste.
          </p>
        </div>

        <InventoryCountSteps
          file={file}
          isExporting={isExporting}
          isAnalyzing={isAnalyzing}
          onExport={exportSheet}
          onSelectFile={selectFile}
        />

        {result && (
          <div className="flex flex-col gap-4">
            <InventoryCountResult result={result} isApplied={isApplied} />

            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button variant="ghost" onClick={reset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
                {isApplied ? "Nova contagem" : "Descartar"}
              </Button>

              {!isApplied && (
                <Button onClick={apply} disabled={!canApply || isApplying} className="gap-2">
                  {isApplying && <Loader2 className="h-4 w-4 animate-spin" />}
                  Aplicar contagem
                </Button>
              )}
            </div>

            {!isApplied && canApply && (
              // A contagem mexe em muitos produtos de uma vez e não tem desfazer
              // em lote — o aviso fica junto do botão, e não numa página de ajuda.
              <p className="text-right text-xs text-muted-foreground">
                Aplicar altera o estoque dos produtos listados acima. Não há como desfazer em lote.
              </p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

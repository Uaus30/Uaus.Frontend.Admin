import React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Checkbox } from "@workspace/ui";
import { ConfirmDialog } from "@workspace/ui";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui";
import { AlertTriangle, Grid3X3 } from "lucide-react";
import type { Grade, VariationDraft } from "../../types";

type ProductEditorDialogsProps = {
  gradesList: Grade[];
  gridModalOpen: boolean;
  setGridModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  selectedGradesInModal: number[];
  toggleGradeInModal: (gradeId: number) => void;
  onGenerateMatrix: () => void;
  variationToDelete: VariationDraft | null;
  setVariationToDelete: React.Dispatch<React.SetStateAction<VariationDraft | null>>;
  onConfirmDeleteVariation: (variation: VariationDraft) => void;
  matrixConfirmOpen: boolean;
  setMatrixConfirmOpen: React.Dispatch<React.SetStateAction<boolean>>;
  variationCount: number;
  onConfirmMatrix: () => void;
};

/**
 * As confirmações da tela de detalhe, fora do formulário.
 *
 * Moram juntas porque são as três decisões destrutivas ou de configuração que a
 * edição de produto abre — e nenhuma delas participa do `<form>`. Deixá-las no
 * orquestrador o empurrava para além do limite de 300 linhas do CLAUDE.md, e
 * cada uma tem estado próprio que não conversa com as outras.
 */
export function ProductEditorDialogs({
  gradesList,
  gridModalOpen,
  setGridModalOpen,
  selectedGradesInModal,
  toggleGradeInModal,
  onGenerateMatrix,
  variationToDelete,
  setVariationToDelete,
  onConfirmDeleteVariation,
  matrixConfirmOpen,
  setMatrixConfirmOpen,
  variationCount,
  onConfirmMatrix,
}: ProductEditorDialogsProps) {
  return (
    <>
      <AlertDialog
        open={variationToDelete !== null}
        onOpenChange={(open) => !open && setVariationToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Variação</AlertDialogTitle>
            <AlertDialogDescription>
              A exclusão de uma variação é irreversível, deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => {
                if (variationToDelete) {
                  onConfirmDeleteVariation(variationToDelete);
                  setVariationToDelete(null);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConfirmDialog
        open={matrixConfirmOpen}
        onOpenChange={setMatrixConfirmOpen}
        title="Gerar uma nova matriz de grades?"
        description={`As ${variationCount} variações que você configurou nesta tela serão apagadas e substituídas pela matriz nova — preço, código de barras e estoque digitados em cada uma se perdem junto. A ação não pode ser desfeita.`}
        confirmLabel="Sim, gerar nova matriz"
        destructive
        onConfirm={onConfirmMatrix}
      />

      <Dialog open={gridModalOpen} onOpenChange={setGridModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Grid3X3 className="w-5 h-5 text-primary" />
              Configurar Grades
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-start gap-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 p-3 rounded-xl border border-amber-500/30">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p className="text-sm leading-tight">
                Aviso: Gerar a matriz cruzará as opções das grades selecionadas. Combinações repetidas serão
                bloqueadas.
              </p>
            </div>
            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2">
              {gradesList.map((grade: Grade) => (
                <label
                  key={grade.id}
                  className="flex items-start gap-3 p-3 border rounded-xl bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedGradesInModal.includes(grade.id)}
                    onCheckedChange={() => toggleGradeInModal(grade.id)}
                  />
                  <div>
                    <p className="font-medium text-sm text-foreground">{grade.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {grade.variants.map((v) => v.value).join(", ")}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGridModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={onGenerateMatrix}>Gerar Variações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

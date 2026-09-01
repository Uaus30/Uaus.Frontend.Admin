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
import type { VariationDraft } from "../../types";

type ProductEditorDialogsProps = {
  variationToDelete: VariationDraft | null;
  setVariationToDelete: React.Dispatch<React.SetStateAction<VariationDraft | null>>;
  onConfirmDeleteVariation: (variation: VariationDraft) => void;
};

/**
 * Confirmação de exclusão de variação, fora do formulário.
 *
 * Sobrou só ela: a escolha de grades virou a `VariationGradesModal`, e o aviso
 * de "a matriz atual será substituída" foi para dentro dessa modal — ali ele
 * aparece junto da decisão que o provoca, e não num segundo diálogo empilhado
 * depois do primeiro.
 */
export function ProductEditorDialogs({
  variationToDelete,
  setVariationToDelete,
  onConfirmDeleteVariation,
}: ProductEditorDialogsProps) {
  return (
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
  );
}

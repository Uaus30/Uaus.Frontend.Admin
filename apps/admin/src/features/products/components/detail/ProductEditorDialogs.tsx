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
import type { PurchaseProductConflict } from "../../hooks/editor/usePurchaseProductConflict";
import { PurchaseProductConflictDialog } from "./PurchaseProductConflictDialog";
import { FirstPhotoSiteDialog } from "./FirstPhotoSiteDialog";

type ProductEditorDialogsProps = {
  variationToDelete: VariationDraft | null;
  setVariationToDelete: React.Dispatch<React.SetStateAction<VariationDraft | null>>;
  onConfirmDeleteVariation: (variation: VariationDraft) => void;
  /** O código bipado já tem dono, e este cadastro veio de uma compra. */
  purchaseConflict: PurchaseProductConflict | null | undefined;
  onGoToConflictingPurchase: () => void;
  onDismissPurchaseConflict: () => void;
  /** A pergunta da primeira foto — ver `useFirstPhotoSitePrompt`. */
  sitePrompt: { open: boolean; publish: () => void; dismiss: () => void };
};

/**
 * Os diálogos do editor que precisam ficar FORA do formulário.
 *
 * O `<form>` da tela de detalhe envolve as três abas, e um `<form>` aninhado
 * seria HTML inválido — por isso as modais moram aqui, e não no meio dos campos.
 *
 * São três:
 *
 * - **exclusão de variação** — o lixo da linha é o ÚNICO caminho que tira uma
 *   variação do cadastro; nem a `VariationGradesModal` nem o salvar excluem
 *   nada, de propósito;
 * - **código já cadastrado num recebimento de compra** — quem se ajusta é a
 *   COMPRA, e a modal leva para lá. Ver `PurchaseProductConflictDialog`;
 * - **primeira foto de cadastro fora do site** — pergunta se ele vai ao ar.
 *   Ver `FirstPhotoSiteDialog`.
 */
export function ProductEditorDialogs({
  variationToDelete,
  setVariationToDelete,
  onConfirmDeleteVariation,
  purchaseConflict,
  onGoToConflictingPurchase,
  onDismissPurchaseConflict,
  sitePrompt,
}: ProductEditorDialogsProps) {
  return (
    <>
      <FirstPhotoSiteDialog
        open={sitePrompt.open}
        onPublish={sitePrompt.publish}
        onDismiss={sitePrompt.dismiss}
      />

      <PurchaseProductConflictDialog
        conflict={purchaseConflict}
        onGoToPurchase={onGoToConflictingPurchase}
        onDismiss={onDismissPurchaseConflict}
      />

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
    </>
  );
}

import React from "react";
import { Button } from "@workspace/ui";
import { ProductBasicInfo } from "../editor/ProductBasicInfo";
import { ProductPricing } from "../editor/ProductPricing";
import { ProductImageGallery } from "../editor/ProductImageGallery";
import { ProductVariationsManager } from "../editor/ProductVariationsManager";
import type { useProductEditor } from "../../hooks/useProductEditor";
import type { VariationDraft } from "../../types";

type ProductGeneralTabProps = {
  editor: ReturnType<typeof useProductEditor>;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  displayBarcode: string;
  currentBarcode: string;
  flashSuccess: boolean;
  onPrintBarcode: () => void;
  onPrintVariationBarcode: (barcode: string, name: string, price: number) => void;
  setSearchModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setVariationToDelete: React.Dispatch<React.SetStateAction<VariationDraft | null>>;
  /** Abre a escolha de grades e valores da variação. */
  onOpenGradePicker: () => void;
};

/**
 * Aba **Dados**: o que a modal mostrava com o olho fechado.
 *
 * É a primeira aba de propósito — são os campos sem os quais o produto não
 * salva (nome, departamento, categoria, preço e status), mais o código de
 * barras e as imagens, que a modal também deixava sempre visíveis.
 */
export function ProductGeneralTab({
  editor,
  validationErrors,
  setValidationErrors,
  displayBarcode,
  currentBarcode,
  flashSuccess,
  onPrintBarcode,
  onPrintVariationBarcode,
  setSearchModalOpen,
  setVariationToDelete,
  onOpenGradePicker,
}: ProductGeneralTabProps) {
  const { form, variationDrafts } = editor;

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-2xl border border-border/50 bg-background/40 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ProductBasicInfo
            editor={editor}
            validationErrors={validationErrors}
            setValidationErrors={setValidationErrors}
            displayBarcode={displayBarcode}
            currentBarcode={currentBarcode}
            flashSuccess={flashSuccess}
            onPrintBarcode={onPrintBarcode}
          />

          <ProductPricing
            editor={editor}
            validationErrors={validationErrors}
            setValidationErrors={setValidationErrors}
          />
        </div>

        <ProductImageGallery editor={editor} setSearchModalOpen={setSearchModalOpen} />
      </div>

      <ProductVariationsManager
        editor={editor}
        validationErrors={validationErrors}
        handlePrintBarcode={onPrintVariationBarcode}
        setVariationToDelete={setVariationToDelete}
      />

      {/*
        O botão continua disponível DEPOIS de gerar a matriz: acrescentar ou
        tirar uma grade é operação normal, e a modal reabre marcada com o que o
        produto já tem. Em produto JÁ CADASTRADO ela só acrescenta e remove
        COLUNA — nenhuma variação é criada nem excluída, e o valor de cada linha
        é digitado na tabela. Trocar o TIPO da grade é no título da coluna.
      */}
      <Button
        type="button"
        className="bg-orange-500 hover:bg-orange-600 text-white"
        onClick={onOpenGradePicker}
      >
        {form.hasVariations || variationDrafts.length > 0 ? "Configurar Variações" : "Cadastrar Variações"}
      </Button>
    </div>
  );
}

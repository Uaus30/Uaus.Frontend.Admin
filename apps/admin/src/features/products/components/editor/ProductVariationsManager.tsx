import React from "react";
import { ProductVariationsSection } from "../ProductVariationsSection";
import type { useProductEditor } from "../../hooks/useProductEditor";

type ProductVariationsManagerProps = {
  editor: ReturnType<typeof useProductEditor>;
  validationErrors: Record<string, boolean>;
  handlePrintBarcode: (barcodeValue: string, customName?: string, customPrice?: number) => void;
  setVariationToDelete: React.Dispatch<React.SetStateAction<any>>;
};

export function ProductVariationsManager({
  editor,
  validationErrors,
  handlePrintBarcode,
  setVariationToDelete,
}: ProductVariationsManagerProps) {
  const {
    form,
    variationDrafts,
    selectedGrades,
    isFetchingGroupProducts,
    selectableStatusOptions,
    updateVariationDraft,
    handleDeleteVariation,
    addVariationDraft,
    changeGradeType,
  } = editor;

  return (
    <ProductVariationsSection
      variationDrafts={variationDrafts}
      selectedGrades={selectedGrades}
      productGroupName={form.productGroupName}
      isFetchingGroupProducts={isFetchingGroupProducts}
      selectableStatusOptions={selectableStatusOptions}
      validationErrors={validationErrors}
      updateVariationDraft={updateVariationDraft}
      handlePrintBarcode={handlePrintBarcode}
      setVariationToDelete={setVariationToDelete}
      handleDeleteVariation={handleDeleteVariation}
      addVariationDraft={addVariationDraft}
      changeGradeType={changeGradeType}
    />
  );
}

import React from "react";
import { ProductImagesSection } from "../ProductImagesSection";
import type { useProductEditor } from "../../hooks/useProductEditor";

type ProductImageGalleryProps = {
  editor: ReturnType<typeof useProductEditor>;
  setSearchModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

export function ProductImageGallery({ editor, setSearchModalOpen }: ProductImageGalleryProps) {
  const { images, setImages, handleSimpleFileSelection, reorderProductImage, form } = editor;

  return (
    <ProductImagesSection
      images={images}
      setImages={setImages}
      handleSimpleFileSelection={handleSimpleFileSelection}
      reorderProductImage={reorderProductImage}
      productName={form.productGroupName}
      onSearchWebImage={() => setSearchModalOpen(true)}
    />
  );
}

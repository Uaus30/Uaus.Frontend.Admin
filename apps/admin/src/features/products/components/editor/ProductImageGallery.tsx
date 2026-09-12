import React from "react";
import { ProductImagesSection } from "../ProductImagesSection";
import type { useProductEditor } from "../../hooks/useProductEditor";

type ProductImageGalleryProps = {
  editor: ReturnType<typeof useProductEditor>;
  setSearchModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

/**
 * A galeria de imagens da aba **Dados** — uma só, do GRUPO.
 *
 * Havia um seletor de variação aqui ("estas fotos são de qual?") enquanto a
 * galeria pertencia ao SKU. Ele saiu em 12/09/2026 com a foto passando para o
 * grupo: a primeira imagem é a capa que a vitrine, o PDV, a listagem e a
 * etiqueta mostram, com ou sem variações.
 */
export function ProductImageGallery({ editor, setSearchModalOpen }: ProductImageGalleryProps) {
  const { form, galleryImages, setGalleryImages, handleGalleryFileSelection, reorderGalleryImage } = editor;

  return (
    <ProductImagesSection
      images={galleryImages}
      setImages={setGalleryImages}
      handleSimpleFileSelection={handleGalleryFileSelection}
      reorderProductImage={reorderGalleryImage}
      productName={form.productGroupName}
      onSearchWebImage={() => setSearchModalOpen(true)}
    />
  );
}

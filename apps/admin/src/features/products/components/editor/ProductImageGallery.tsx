import React from "react";
import { ProductImagesSection } from "../ProductImagesSection";
import { rotuloDaCombinacao } from "../../lib/variationMatrix";
import type { useProductEditor } from "../../hooks/useProductEditor";

type ProductImageGalleryProps = {
  editor: ReturnType<typeof useProductEditor>;
  setSearchModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

/**
 * A galeria de imagens da aba **Dados**.
 *
 * Em produto simples ela edita as fotos do próprio produto. Em grupo COM
 * variações ela edita as fotos de UMA variação por vez — as imagens são por
 * variação (toalha por cor, forma por tamanho), e é assim que o
 * `handleSubmit` as grava.
 *
 * A escolha do alvo não é feita aqui: o hook já entrega `galleryImages` e os
 * três manipuladores apontados para o lugar certo. Ver `useProductEditor`, que
 * explica o bug de 06/09/2026 — a galeria escrevia no estado do produto simples
 * mesmo em grupo com variações, e a foto era descartada em silêncio, com toast
 * de sucesso.
 */
export function ProductImageGallery({ editor, setSearchModalOpen }: ProductImageGalleryProps) {
  const {
    form,
    galleryImages,
    setGalleryImages,
    handleGalleryFileSelection,
    reorderGalleryImage,
    variationDrafts,
    activeVariationKey,
    setActiveVariationKey,
  } = editor;

  return (
    <div className="space-y-3">
      {/* O seletor só existe quando há mais de uma variação: com uma só, ele
          seria um combo de um item ocupando linha para não decidir nada. Com
          duas ou mais, ele é o que responde "estas fotos são de qual?" — sem
          ele a galeria mostraria as fotos de uma variação sem dizer de qual. */}
      {form.hasVariations && variationDrafts.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm font-medium" htmlFor="galeria-variacao">
            Imagens da variação
          </label>
          <select
            id="galeria-variacao"
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={activeVariationKey ?? ""}
            onChange={(event) => setActiveVariationKey(event.target.value)}
          >
            {variationDrafts.map((draft, index) => (
              <option key={draft.key} value={draft.key}>
                {rotuloDaCombinacao(draft.values) || `Variação ${index + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

      <ProductImagesSection
        images={galleryImages}
        setImages={setGalleryImages}
        handleSimpleFileSelection={handleGalleryFileSelection}
        reorderProductImage={reorderGalleryImage}
        productName={form.productGroupName}
        onSearchWebImage={() => setSearchModalOpen(true)}
      />
    </div>
  );
}

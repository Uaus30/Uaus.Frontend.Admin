import { Dialog, DialogContent, DialogTitle } from "@workspace/ui";
import type { CatalogProductDetail } from "../types";
import { ProductImage } from "./ProductImage";

interface ProductGalleryProps {
  product: CatalogProductDetail;
  selectedIndex: number;
  onSelect: (index: number) => void;
  isLightboxOpen: boolean;
  onLightboxChange: (open: boolean) => void;
}

/**
 * Galeria do detalhe: imagem principal, miniaturas e ampliação.
 *
 * A ampliação usa o Dialog do `@workspace/ui` (Radix) em vez do overlay manual
 * do site antigo — Esc, clique fora, trava de scroll e foco vêm prontos e
 * testados; o lightbox antigo não tinha nenhum dos quatro.
 */
export function ProductGallery({
  product,
  selectedIndex,
  onSelect,
  isLightboxOpen,
  onLightboxChange,
}: ProductGalleryProps) {
  const images = product.images;
  const selected = images[selectedIndex] ?? images[0];

  return (
    <div>
      <button
        type="button"
        onClick={() => selected && onLightboxChange(true)}
        className="block w-full cursor-zoom-in overflow-hidden rounded-3xl border border-border bg-white shadow-lg"
        aria-label="Ampliar a foto do produto"
      >
        <ProductImage
          src={selected?.url}
          alt={product.name}
          loading="eager"
          className="aspect-square w-full object-cover"
        />
      </button>

      {images.length > 1 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => onSelect(index)}
              aria-label={`Ver a foto ${index + 1}`}
              aria-current={index === selectedIndex}
              className={
                index === selectedIndex
                  ? "h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-2 ring-primary"
                  : "h-20 w-20 shrink-0 overflow-hidden rounded-xl opacity-70 transition-opacity hover:opacity-100"
              }
            >
              <ProductImage src={image.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={isLightboxOpen} onOpenChange={onLightboxChange}>
        <DialogContent className="max-w-3xl border-0 bg-transparent p-0 shadow-none">
          <DialogTitle className="sr-only">{product.name}</DialogTitle>
          <ProductImage
            src={selected?.url}
            alt={product.name}
            loading="eager"
            className="max-h-[80vh] w-full rounded-2xl object-contain"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

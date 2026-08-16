import React from "react";
import { Plus, Upload, X, HelpCircle, Globe } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui";
import { Button } from "@workspace/ui";
import type { LocalImage } from "../types";

type ProductImagesSectionProps = {
  /** Array of currently uploaded or selected images in the frontend form */
  images: LocalImage[];
  /** State setter callback to update the image collection */
  setImages: React.Dispatch<React.SetStateAction<LocalImage[]>>;
  /** Event handler triggered when a file input receives user selections */
  handleSimpleFileSelection: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Callback to update the sorting order of images (drag and drop) */
  reorderProductImage: (oldIndex: number, newIndex: number) => void;
  /** O nome do produto, necessário para validar se a busca está habilitada */
  productName: string;
  /** Callback opcional para acionar a busca de imagens na web */
  onSearchWebImage?: () => void;
};

/**
 * ProductImagesSection
 *
 * Renders the image manager for a product.
 * Features:
 * - Displays a grid of uploaded images (or a placeholder if empty).
 * - Drag-and-drop image reordering to customize display order (first image is primary).
 * - Multi-file selection support.
 * - Single image deletion button.
 * - Internet search integration.
 */
export function ProductImagesSection({
  images,
  setImages,
  handleSimpleFileSelection,
  reorderProductImage,
  productName,
  onSearchWebImage,
}: ProductImagesSectionProps) {
  return (
    <div className="space-y-3 border-t border-border/30 pt-4 mt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <label className="text-sm font-medium">Imagens do produto</label>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger type="button" tabIndex={-1}>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Arraste as imagens para ordenar ou cole (Ctrl+V) uma imagem copiada para adicioná-la.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {onSearchWebImage && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSearchWebImage}
            disabled={!productName.trim()}
            className="h-8 text-xs gap-1.5"
            title={
              !productName.trim()
                ? "Preencha o nome do produto para habilitar a busca"
                : "Buscar imagens na internet"
            }
          >
            <Globe className="h-3.5 w-3.5" />
            Buscar na Web
          </Button>
        )}
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {images.map((image, index) => (
            <div
              key={`${image.name}-${index}`}
              className="relative overflow-hidden rounded-xl border border-border/50 bg-background/50 cursor-grab active:cursor-grabbing hover:ring-2 ring-primary/50 transition-all"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", index.toString());
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const oldIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
                if (!isNaN(oldIndex) && oldIndex !== index) {
                  reorderProductImage(oldIndex, index);
                }
              }}
            >
              <img
                loading="lazy"
                decoding="async"
                src={image.url}
                alt={image.name}
                className="aspect-square w-full object-cover pointer-events-none"
              />
              <div className="p-2 pointer-events-none">
                <p className="truncate text-xs font-medium">{image.name}</p>
                {index === 0 && <p className="mt-1 text-[10px] text-primary">Imagem principal</p>}
              </div>
              <div className="absolute right-2 top-2 flex gap-1">
                <button
                  type="button"
                  className="rounded bg-card/90 p-1 text-destructive hover:bg-destructive/10 cursor-pointer transition-colors"
                  onClick={() =>
                    setImages((current) => current.filter((_, currentIndex) => currentIndex !== index))
                  }
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
          <label className="relative flex items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-border/40 bg-background/20 hover:bg-muted/30 hover:border-primary/40 transition-colors cursor-pointer aspect-square min-h-[140px]">
            <Plus className="h-10 w-10 text-muted-foreground/50" />
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleSimpleFileSelection}
            />
          </label>
        </div>
      ) : (
        <label className="block rounded-xl border-2 border-dashed border-border/40 hover:border-primary/50 hover:bg-muted/20 p-8 text-center text-muted-foreground text-sm cursor-pointer transition-colors">
          <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="font-medium">Nenhuma imagem selecionada</p>
          <p className="text-xs mt-1">Clique ou cole (Ctrl+V) para adicionar fotos.</p>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleSimpleFileSelection}
          />
        </label>
      )}
    </div>
  );
}

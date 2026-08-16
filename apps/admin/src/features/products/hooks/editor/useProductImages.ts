import { useToast } from "@workspace/ui";
import { optimizeImage } from "@/lib/imageOptimizer";
import { reorderItems, moveItemTo } from "./utils";
import { buildPublicImageUrl } from "@/services/core";
import type { LocalImage, VariationDraft } from "../../types";

export interface UseProductImagesProps {
  setImages: React.Dispatch<React.SetStateAction<LocalImage[]>>;
  activeVariation: VariationDraft | null;
  updateVariationDraft: (key: string, updater: (draft: VariationDraft) => VariationDraft) => void;
}

export function useProductImages({
  setImages,
  activeVariation,
  updateVariationDraft,
}: UseProductImagesProps) {
  const { toast } = useToast();

  function moveProductImage(index: number, direction: -1 | 1) {
    setImages((current) => reorderItems(current, index, direction));
  }

  function reorderProductImage(oldIndex: number, newIndex: number) {
    setImages((current) => moveItemTo(current, oldIndex, newIndex));
  }

  function moveVariationImage(index: number, direction: -1 | 1) {
    if (!activeVariation) return;
    updateVariationDraft(activeVariation.key, (draft) => ({
      ...draft,
      images: reorderItems(draft.images, index, direction),
    }));
  }

  async function handleSimpleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = Array.from(event.target.files ?? []);
    const nextImages: { name: string; url: string; file: File }[] = [];
    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;
    let optimizedAny = false;

    for (const file of fileList) {
      const result = await optimizeImage(file);
      totalOriginalSize += result.originalSize;
      totalOptimizedSize += result.optimizedSize;
      if (result.optimized) {
        optimizedAny = true;
      }
      nextImages.push({
        name: result.file.name.replace(/\.[^/.]+$/, ""),
        url: URL.createObjectURL(result.file),
        file: result.file,
      });
    }

    if (optimizedAny) {
      toast({
        title: "Imagens otimizadas",
        description: `${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB reduzido para ${(totalOptimizedSize / 1024).toFixed(0)}KB (economizou ${Math.round((1 - totalOptimizedSize / totalOriginalSize) * 100)}%)`,
      });
    }

    setImages((current) => [...current, ...(nextImages as any)]);
  }

  async function handleVariationFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    if (!activeVariation) return;

    const fileList = Array.from(event.target.files ?? []);
    const nextImages: { name: string; url: string; file: File }[] = [];
    let totalOriginalSize = 0;
    let totalOptimizedSize = 0;
    let optimizedAny = false;

    for (const file of fileList) {
      const result = await optimizeImage(file);
      totalOriginalSize += result.originalSize;
      totalOptimizedSize += result.optimizedSize;
      if (result.optimized) {
        optimizedAny = true;
      }
      nextImages.push({
        name: result.file.name.replace(/\.[^/.]+$/, ""),
        url: URL.createObjectURL(result.file),
        file: result.file,
      });
    }

    if (optimizedAny) {
      toast({
        title: "Imagens otimizadas",
        description: `${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB reduzido para ${(totalOptimizedSize / 1024).toFixed(0)}KB (economizou ${Math.round((1 - totalOptimizedSize / totalOriginalSize) * 100)}%)`,
      });
    }

    updateVariationDraft(activeVariation.key, (draft) => ({
      ...draft,
      images: [...draft.images, ...(nextImages as any)],
    }));
  }

  function toLocalImages(items: any[] = []) {
    return items.map((item: any) => ({
      imageId: item.imageId,
      associationId: item.associationId,
      name: item.image.name,
      url: buildPublicImageUrl(item.image.url),
    }));
  }

  return {
    moveProductImage,
    reorderProductImage,
    moveVariationImage,
    handleSimpleFileSelection,
    handleVariationFileSelection,
    toLocalImages,
  };
}

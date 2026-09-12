import { useToast } from "@workspace/ui";
import { optimizeImage } from "@/lib/imageOptimizer";
import { reorderItems, moveItemTo } from "./utils";
import { buildPublicImageUrl } from "@/services/core";
import type { LocalImage, ProductTableRowImage } from "../../types";

export interface UseProductImagesProps {
  setImages: React.Dispatch<React.SetStateAction<LocalImage[]>>;
}

/**
 * A galeria do cadastro — UMA, do grupo.
 *
 * Até 12/09/2026 havia duas: a do produto simples e a da variação ativa, com
 * um par de funções para cada (`setVariationImages`, `handleVariationFileSelection`,
 * `reorderVariationImage`) e um `if (hasVariations)` em todo chamador. O
 * catálogo mostrou que a segunda nunca foi usada de verdade — 707 produtos com
 * foto e 707 associações, uma foto por produto —, e a foto passou a pertencer
 * ao grupo (`product_group_images`). Sobrou uma galeria só, e nenhum ramo.
 */
export function useProductImages({ setImages }: UseProductImagesProps) {
  const { toast } = useToast();

  function moveProductImage(index: number, direction: -1 | 1) {
    setImages((current) => reorderItems(current, index, direction));
  }

  function reorderProductImage(oldIndex: number, newIndex: number) {
    setImages((current) => moveItemTo(current, oldIndex, newIndex));
  }

  /**
   * Arquivos escolhidos entram na galeria já otimizados.
   *
   * A compressão acontece ANTES do upload, como nas fotos da compra: a foto do
   * site do fornecedor é PNG de vários MB, e um punhado delas estoura o que a
   * hospedagem aceita.
   */
  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
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

    setImages((current) => [...current, ...(nextImages as LocalImage[])]);
  }

  /** As fotos da linha da tabela, no formato que a galeria da tela consome. */
  function toLocalImages(items: ProductTableRowImage[] = []): LocalImage[] {
    return items.map((item) => ({
      imageId: item.imageId,
      associationId: item.associationId,
      name: item.image.name,
      url: buildPublicImageUrl(item.image.url),
    }));
  }

  return {
    moveProductImage,
    reorderProductImage,
    handleFileSelection,
    toLocalImages,
  };
}

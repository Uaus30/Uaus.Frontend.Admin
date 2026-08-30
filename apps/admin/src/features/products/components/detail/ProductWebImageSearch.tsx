import React from "react";
import { useToast } from "@workspace/ui";
import { downloadWebImageAsFile } from "@/services/images.service";
import { optimizeImage } from "@/lib/imageOptimizer";
import type { useProductEditor } from "../../hooks/useProductEditor";
import { ProductImageSearchModal } from "../ProductImageSearchModal";

type ProductWebImageSearchProps = {
  editor: ReturnType<typeof useProductEditor>;
  open: boolean;
  onOpenChange: React.Dispatch<React.SetStateAction<boolean>>;
};

/**
 * Busca de imagem na web ligada à galeria do produto em edição.
 *
 * A escolhida entra como imagem LOCAL da galeria, e não como associação já
 * gravada: enquanto o produto não é salvo não existe id para associar, e a foto
 * precisa poder ser reordenada e removida antes disso.
 *
 * O download passa pelo `services/images` porque a imagem vem de outro domínio
 * e a requisição precisa do proxy autenticado — buscar direto do navegador
 * esbarra em CORS, e o tratamento do 401 fica num lugar só.
 */
export function ProductWebImageSearch({ editor, open, onOpenChange }: ProductWebImageSearchProps) {
  const { toast } = useToast();
  const { form, productEditor, setImages } = editor;

  async function handleSelectImage(imageUrl: string) {
    const file = await downloadWebImageAsFile(imageUrl, form.productGroupName || "produto");
    const optimized = await optimizeImage(file);

    if (optimized.optimized) {
      toast({
        title: "Imagem otimizada",
        description: `${(optimized.originalSize / 1024 / 1024).toFixed(2)}MB reduzido para ${(optimized.optimizedSize / 1024).toFixed(0)}KB (economizou ${Math.round((1 - optimized.optimizedSize / optimized.originalSize) * 100)}%)`,
      });
    }

    setImages((current) => [
      ...current,
      {
        name: optimized.file.name.replace(/\.[^/.]+$/, ""),
        url: URL.createObjectURL(optimized.file),
        file: optimized.file,
      },
    ]);
  }

  return (
    <ProductImageSearchModal
      productName={form.productGroupName}
      barcode={productEditor.barcode}
      isOpen={open}
      onOpenChange={onOpenChange}
      onSelectImage={handleSelectImage}
    />
  );
}

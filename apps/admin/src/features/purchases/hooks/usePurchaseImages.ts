import { useState } from "react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { buildPublicImageUrl } from "@workspace/api-client-react";
import { createImageFromFile, downloadWebImageAsFile } from "@/services/images.service";
import { collectPastedImageFiles } from "@/features/products/lib/pasteProductImages";
import { optimizeImage } from "@/lib/imageOptimizer";
import type { PurchaseForm, PurchaseFormImage } from "../types";

/** Tipo de imagem "Produtos" no enum ImageType do backend. */
const IMAGE_TYPE_PRODUCTS = 3;

/** O texto colado é uma URL http(s)? É o que o proxy do backend sabe buscar. */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type UsePurchaseImagesParams = {
  /** Nome do produto: batiza o arquivo enviado ao catálogo. */
  productName: string;
  setForm: React.Dispatch<React.SetStateAction<PurchaseForm>>;
};

/**
 * As fotos da compra: os quatro caminhos de entrada e a remoção.
 *
 * Toda foto — arquivo escolhido, colagem, URL ou busca na web — passa pelo
 * MESMO funil: `optimizeImage` antes do upload. Isso não é economia de disco, é
 * limite de plataforma: a foto que vem do site do fornecedor é PNG de vários
 * MB, e o upload de um punhado delas estourava o que a hospedagem aceita. Como
 * o funil é um só, não existe caminho que escape do tratamento.
 *
 * A URL e a busca na web passam antes pelo PROXY do backend: a imagem vem de
 * domínio de terceiro e o navegador bloquearia a leitura por CORS.
 *
 * O upload acontece na hora em que a foto entra no formulário — a compra guarda
 * só os ids. É o mesmo catálogo do produto, e no recebimento de produto novo as
 * mesmas imagens viram a galeria do cadastro sem novo upload.
 *
 * Mora fora do `usePurchaseForm` porque os dois juntos passariam das 300 linhas
 * por arquivo, e porque a foto é um assunto inteiro: quatro entradas, proxy,
 * compressão e upload.
 */
export function usePurchaseImages({ productName, setForm }: UsePurchaseImagesParams) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);

  /**
   * Comprime, envia ao catálogo e acrescenta ao formulário.
   *
   * O aviso de otimização só aparece quando a imagem encolheu de verdade — é a
   * confirmação de que a foto de 8 MB do fornecedor não subiu inteira.
   */
  async function addImageFile(file: File) {
    setUploading(true);
    try {
      const optimized = await optimizeImage(file);
      const created = await createImageFromFile({
        file: optimized.file,
        name: productName.trim() || file.name,
        type: IMAGE_TYPE_PRODUCTS,
      });
      const image: PurchaseFormImage = {
        imageId: created.id,
        url: buildPublicImageUrl(created.url),
        name: created.name,
      };
      setForm((current) => ({ ...current, images: [...current.images, image] }));

      if (optimized.optimized) {
        toast({
          title: "Imagem otimizada",
          description: `${(optimized.originalSize / 1024 / 1024).toFixed(2)}MB reduzidos para ${(optimized.optimizedSize / 1024).toFixed(0)}KB.`,
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao enviar a imagem",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }

  async function handleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    for (const file of files) {
      await addImageFile(file);
    }
  }

  /** Foto de fora da loja (busca na web ou URL digitada): baixa pelo proxy e envia. */
  async function addWebImage(webImageUrl: string) {
    const file = await downloadWebImageAsFile(webImageUrl, productName || "compra");
    await addImageFile(file);
  }

  /**
   * Uma URL de imagem informada à mão.
   *
   * Devolve `false` quando a URL não serve, para o campo da tela não se limpar
   * com o endereço que a pessoa ainda quer corrigir.
   */
  async function addImageFromUrl(rawUrl: string): Promise<boolean> {
    const url = rawUrl.trim();
    if (!isHttpUrl(url)) {
      toast({
        title: "URL inválida",
        description: "Informe um endereço que comece com http:// ou https://.",
        variant: "warning",
      });
      return false;
    }

    try {
      await addWebImage(url);
      return true;
    } catch (error) {
      toast({
        title: "Não foi possível baixar a imagem",
        description: describeApiError(error, "Confira a URL e tente novamente."),
        variant: "destructive",
      });
      return false;
    }
  }

  /**
   * Ctrl+V no formulário da compra.
   *
   * É o caminho mais curto que existe: o operador copia a foto do anúncio do
   * fornecedor e cola. A colagem traz imagem em duas formas, e as duas contam —
   * o ARQUIVO (print, "copiar imagem") e a URL como TEXTO ("copiar endereço da
   * imagem"), que é o que o botão direito do navegador oferece com mais
   * frequência.
   *
   * Colagem sem imagem nenhuma é ignorada de propósito: quem cola texto num
   * campo de texto está preenchendo o campo, não anexando foto.
   */
  async function handlePaste(event: React.ClipboardEvent) {
    const files = collectPastedImageFiles(event.clipboardData?.items);
    if (files.length > 0) {
      event.preventDefault();
      for (const file of files) {
        await addImageFile(file);
      }
      return;
    }

    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (!isHttpUrl(text)) return;

    // Um link colado dentro de um campo de digitação é conteúdo do campo (o
    // "Link da compra" é justamente uma URL); só fora deles ele é foto.
    const target = event.target as HTMLElement | null;
    if (target?.closest("input, textarea, [contenteditable='true']")) return;

    event.preventDefault();
    await addImageFromUrl(text);
  }

  function removeImage(imageId: number) {
    setForm((current) => ({
      ...current,
      images: current.images.filter((image) => image.imageId !== imageId),
    }));
  }

  return {
    uploading,
    imageSearchOpen,
    setImageSearchOpen,
    handleFileSelection,
    addWebImage,
    addImageFromUrl,
    handlePaste,
    removeImage,
  };
}

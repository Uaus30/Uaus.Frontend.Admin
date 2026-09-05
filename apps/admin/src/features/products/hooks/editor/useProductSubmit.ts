import { useToast } from "@workspace/ui";
import {
  saveProductGroupWithProducts,
  type SaveProductGroupProductPayload,
} from "@workspace/api-client-react";
import { buildPublicImageUrl } from "@/services/core";
import { syncProductTags, syncProductImages } from "@/services/products.service";
import { createImageFromFile } from "@/services/images.service";
import { chaveDaCombinacao } from "../../lib/variationMatrix";
import type { LocalImage, ProductGroupForm, ProductEditorForm, VariationDraft } from "../../types";
import { describeApiError } from "@workspace/core";

export interface UseProductSubmitProps {
  form: ProductGroupForm;
  editingGroupId: number | null;
  setEditingGroupId: React.Dispatch<React.SetStateAction<number | null>>;
  productEditor: ProductEditorForm;
  setProductEditor: React.Dispatch<React.SetStateAction<ProductEditorForm>>;
  variationDrafts: VariationDraft[];
  setVariationDrafts: React.Dispatch<React.SetStateAction<VariationDraft[]>>;
  images: LocalImage[];
  setImages: React.Dispatch<React.SetStateAction<LocalImage[]>>;
  setActiveVariationKey: React.Dispatch<React.SetStateAction<string | null>>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  invalidateProductQueries: (groupId?: number | null) => Promise<void>;
  refetchGroupProducts: () => Promise<any>;
  productTags: any[];
  productImages: any[];
  getStatusNumber: (statusVal: any) => number;
  markClean: () => void;
}

export function useProductSubmit({
  form,
  editingGroupId,
  setEditingGroupId,
  productEditor,
  setProductEditor,
  variationDrafts,
  setVariationDrafts,
  images,
  setImages,
  setActiveVariationKey,
  setSaving,
  invalidateProductQueries,
  refetchGroupProducts,
  productTags,
  productImages,
  getStatusNumber,
  markClean,
}: UseProductSubmitProps) {
  const { toast } = useToast();

  async function persistProductAssociations(productId: number, tagIds: number[], sourceImages: LocalImage[]) {
    const currentTagAssociations = productTags.filter((item) => item.productId === productId);
    await syncProductTags({
      productId,
      currentAssociations: currentTagAssociations,
      nextTagIds: tagIds,
    });

    const normalizedImages: LocalImage[] = [];
    for (const image of sourceImages) {
      if (image.imageId) {
        normalizedImages.push(image);
        continue;
      }
      if (!image.file) continue;
      const created = await createImageFromFile({
        file: image.file,
        name: image.name,
        type: 3,
      });
      normalizedImages.push({
        ...image,
        imageId: created.id,
        url: buildPublicImageUrl(created.url),
      });
    }

    const nextImages = normalizedImages.map((image, index) => ({
      imageId: image.imageId as number,
      displayOrder: index,
    }));

    await syncProductImages({
      productId,
      currentAssociations: productImages.filter((item) => item.productId === productId),
      nextImages,
    });

    return normalizedImages;
  }

  /**
   * Grava o cadastro inteiro.
   *
   * Devolve `true` quando gravou e `false` quando o toast de erro já foi
   * exibido — é o que permite ao "Avançar" trocar de aba só depois de o
   * servidor confirmar, em vez de levar o operador para a aba Estoque de um
   * produto que não existe.
   *
   * A tela NÃO fecha depois de salvar, nem em produto simples: desde 05/09/2026
   * o cadastro novo continua aberto para a entrada de estoque ser lançada na
   * sequência, que é o fluxo de quem acabou de receber mercadoria nova. Antes,
   * salvar um produto simples fechava a tela e o operador tinha que procurá-lo
   * na lista para voltar à aba Estoque.
   */
  async function handleSubmit(event?: React.FormEvent): Promise<boolean> {
    event?.preventDefault();

    setSaving(true);
    try {
      if (!form.categoryId || !form.productGroupName.trim()) {
        throw new Error("Preencha categoria e nome do produto pai.");
      }

      let produtos: SaveProductGroupProductPayload[];

      if (!form.hasVariations) {
        if (!productEditor.name.trim() || !productEditor.status) {
          throw new Error("Preencha nome, status e os dados do produto simples.");
        }

        produtos = [
          {
            id: productEditor.id,
            name: productEditor.name,
            description: productEditor.description,
            barcode: productEditor.barcode,
            price: productEditor.price,
            minStock: productEditor.minStock,
            status: getStatusNumber(productEditor.status),
          },
        ];
      } else {
        if (variationDrafts.length < 2) {
          throw new Error("O cadastro com variações deve ter no mínimo duas variações.");
        }

        // Duas variações do mesmo grupo não podem ter a mesma combinação de
        // grades: elas teriam o mesmo nome exibido e ninguém saberia qual vender.
        // O backend recusa também — aqui é o retorno rápido, sem ida à rede.
        const combinacoes = new Set<string>();
        for (const draft of variationDrafts) {
          if (draft.values.length === 0) {
            throw new Error("Toda variação precisa de pelo menos um valor de grade.");
          }
          if (!draft.status) {
            throw new Error("Preencha o status em todas as variações.");
          }

          const chave = chaveDaCombinacao(draft.values);
          if (combinacoes.has(chave)) {
            throw new Error(
              "Existem variações com a mesma combinação de grades. Remova a duplicidade para continuar.",
            );
          }
          combinacoes.add(chave);
        }

        // O nome gravado é o do GRUPO, igual em todas as variações. O que
        // distingue uma da outra são os valores de grade, e o colchete é
        // montado na leitura — ver `ProductDisplayName` no backend.
        produtos = variationDrafts.map((draft) => ({
          id: draft.id,
          name: form.productGroupName,
          description: draft.description,
          barcode: draft.barcode,
          price: draft.price,
          minStock: draft.minStock,
          status: getStatusNumber(draft.status),
          variationValues: draft.values.map((value, index) => ({
            gradeType: value.gradeType,
            value: value.value.trim(),
            displayOrder: index,
          })),
        }));
      }

      // UMA requisição, uma transação: ou o cadastro inteiro grava, ou nada
      // muda. Antes eram N upserts em série — um código de barras duplicado na
      // terceira variação deixava grupo e duas variações salvos, e o toast só
      // dizia "erro ao salvar".
      const saved = await saveProductGroupWithProducts({
        groupId: editingGroupId,
        categoryId: Number(form.categoryId),
        name: form.productGroupName,
        description: form.description,
        hasVariations: form.hasVariations,
        showOnSite: form.isPublic,
        products: produtos,
      });

      if (!editingGroupId) {
        setEditingGroupId(saved.group.id);
      }

      // Etiquetas e imagens continuam como sincronizações à parte: imagem passa
      // por upload (fora de qualquer transação de banco) e uma falha aqui deixa
      // o CATÁLOGO íntegro — só a associação fica para refazer.
      if (!form.hasVariations) {
        const product = saved.products[0];
        const normalizedImages = await persistProductAssociations(product.id, productEditor.tagIds, images);

        setProductEditor((current) => ({ ...current, id: product.id }));
        setImages(normalizedImages);
      } else {
        const nextDrafts: VariationDraft[] = [];
        for (let index = 0; index < variationDrafts.length; index++) {
          const draft = variationDrafts[index];
          // Resposta na MESMA ordem do envio — é o contrato do endpoint.
          const product = saved.products[index];
          const normalizedImages = await persistProductAssociations(product.id, draft.tagIds, draft.images);

          nextDrafts.push({
            ...draft,
            id: product.id,
            images: normalizedImages,
            canDelete: product.canDelete,
            key: draft.id ? draft.key : `product-${product.id}`,
          });
        }

        setVariationDrafts(nextDrafts);
        // Por POSIÇÃO, não por nome: o nome é o do grupo em todas as variações,
        // e casar por ele devolvia sempre a primeira — salvar "pulava" a seleção.
        setActiveVariationKey((current) => {
          if (!current) return nextDrafts[0]?.key ?? null;
          const index = variationDrafts.findIndex((draft) => draft.key === current);
          return nextDrafts[index]?.key ?? nextDrafts[0]?.key ?? null;
        });
      }

      await invalidateProductQueries(saved.group.id);
      if (form.hasVariations) {
        await refetchGroupProducts();
      }

      toast({
        title: form.hasVariations
          ? "Grupo e variações salvos."
          : editingGroupId
            ? "Produto atualizado."
            : "Produto criado.",
      });

      // O que está na tela agora é o que o servidor gravou: a tela continua
      // aberta, mas não pode seguir contando como alterada.
      markClean();
      return true;
    } catch (error) {
      toast({
        title: "Erro ao salvar produto",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
      return false;
    } finally {
      setSaving(false);
    }
  }

  return { handleSubmit };
}

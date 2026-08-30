import { useToast } from "@workspace/ui";
import { buildPublicImageUrl } from "@/services/core";
import {
  createProductGroup,
  updateProductGroup,
  upsertProduct,
  syncProductTags,
  syncProductImages,
} from "@/services/products.service";
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
  setModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  resetForm: () => void;
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
  setModalOpen,
  resetForm,
}: UseProductSubmitProps) {
  const { toast } = useToast();

  async function persistGroup() {
    if (!form.categoryId || !form.productGroupName.trim()) {
      throw new Error("Preencha categoria e nome do produto pai.");
    }

    if (editingGroupId) {
      const updatedGroup = await updateProductGroup({
        id: editingGroupId,
        categoryId: Number(form.categoryId),
        name: form.productGroupName,
        description: form.description,
        hasVariations: form.hasVariations,
        showOnSite: form.isPublic,
      });
      return updatedGroup;
    }

    const createdGroup = await createProductGroup({
      categoryId: Number(form.categoryId),
      name: form.productGroupName,
      description: form.description,
      hasVariations: form.hasVariations,
      showOnSite: form.isPublic,
    });
    setEditingGroupId(createdGroup.id);
    return createdGroup;
  }

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

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    setSaving(true);
    try {
      const group = await persistGroup();

      if (!form.hasVariations) {
        if (!productEditor.name.trim() || !productEditor.status) {
          throw new Error("Preencha nome, status e os dados do produto simples.");
        }

        const product = await upsertProduct({
          id: productEditor.id,
          productGroupId: group.id,
          name: productEditor.name,
          description: productEditor.description,
          barcode: productEditor.barcode,
          price: productEditor.price,
          minStock: productEditor.minStock,
          status: getStatusNumber(productEditor.status),
        });

        const normalizedImages = await persistProductAssociations(product.id, productEditor.tagIds, images);

        setProductEditor((current) => ({ ...current, id: product.id }));
        setImages(normalizedImages);
      } else {
        if (variationDrafts.length < 2) {
          throw new Error("O cadastro com variações deve ter no mínimo duas variações.");
        }

        // Duas variações do mesmo grupo não podem ter a mesma combinação de
        // grades: elas teriam o mesmo nome exibido e ninguém saberia qual vender.
        // O nome não serve mais de critério — ele é o do grupo em todas.
        const combinacoes = new Set<string>();
        for (const draft of variationDrafts) {
          if (draft.values.length === 0) {
            throw new Error("Toda variação precisa de pelo menos um valor de grade.");
          }

          const chave = chaveDaCombinacao(draft.values);
          if (combinacoes.has(chave)) {
            throw new Error(
              "Existem variações com a mesma combinação de grades. Remova a duplicidade para continuar.",
            );
          }
          combinacoes.add(chave);
        }

        const nextDrafts: VariationDraft[] = [];
        for (const draft of variationDrafts) {
          if (!draft.status) {
            throw new Error("Preencha o status em todas as variações.");
          }

          // O nome gravado é o do GRUPO, igual em todas as variações. O que
          // distingue uma da outra são os valores de grade, e o colchete é
          // montado na leitura — ver `ProductDisplayName` no backend.
          const product = await upsertProduct({
            id: draft.id,
            productGroupId: group.id,
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
          });

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
        setActiveVariationKey((current) => {
          if (!current) return nextDrafts[0]?.key ?? null;
          const active = variationDrafts.find((draft) => draft.key === current);
          if (!active) return nextDrafts[0]?.key ?? null;
          const match = nextDrafts.find((draft) => draft.id === active.id || draft.name === active.name);
          return match?.key ?? nextDrafts[0]?.key ?? null;
        });
      }

      await invalidateProductQueries(group.id);
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

      if (!form.hasVariations) {
        setModalOpen(false);
        resetForm();
      }
    } catch (error) {
      toast({
        title: "Erro ao salvar produto",
        description: describeApiError(error, "Tente novamente."),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return { handleSubmit };
}

import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProductsPage } from "@/services/products.service";

import { buildProductCollections } from "@/services/mappers";
import {
  GRADE_TYPE,
  enumCode,
  type GradeTypeCode,
  type ProductVariationValueDto,
} from "@workspace/api-client-react";
import type { LocalImage, ProductGroupForm, ProductEditorForm, VariationDraft } from "../types";
import { createEmptyProductEditor } from "./editor/utils";
import { gradesDasVariacoes } from "../lib/variationMatrix";

import { useBarcodeLookup } from "./editor/useBarcodeLookup";
import { useProductForm } from "./editor/useProductForm";
import { useProductVariations } from "./editor/useProductVariations";
import { useProductImages } from "./editor/useProductImages";
import { useProductSubmit } from "./editor/useProductSubmit";
import { CATALOG_KEYS, RESOURCE_KEYS, useAllImages, useAllProductImages } from "@/hooks/use-catalog";

export function useProductEditor() {
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [loadedGroupId, setLoadedGroupId] = useState<number | null>(null);
  const [activeVariationKey, setActiveVariationKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [images, setImages] = useState<LocalImage[]>([]);
  const [form, setForm] = useState<ProductGroupForm>({
    departmentId: "",
    categoryId: "",
    productGroupName: "",
    description: "",
    hasVariations: false,
    isPublic: true,
  });
  const [productEditor, setProductEditor] = useState<ProductEditorForm>(createEmptyProductEditor());
  const [variationDrafts, setVariationDrafts] = useState<VariationDraft[]>([]);
  /**
   * Grades deste produto e os valores de cada uma, DERIVADOS das variações.
   *
   * Não é estado nem catálogo: as variações já carregam os valores, venham da
   * matriz recém-gerada ou do servidor. Guardar à parte exigiria um efeito para
   * sincronizar ao abrir um produto salvo — e a tabela mostraria as colunas de
   * grade só depois de um render a mais.
   */
  const selectedGrades = useMemo(() => gradesDasVariacoes(variationDrafts), [variationDrafts]);

  const productForm = useProductForm({
    form,
    setForm,
    productEditor,
    setProductEditor,
    setEditingGroupId,
    setLoadedGroupId,
    setActiveVariationKey,
    setVariationDrafts,
    setImages,
  });

  const {
    data: groupProductsPage,
    isFetching: isFetchingGroupProducts,
    refetch: refetchGroupProducts,
  } = useQuery({
    queryKey: ["products-by-group", editingGroupId],
    enabled: modalOpen && editingGroupId != null && form.hasVariations,
    queryFn: () =>
      getProductsPage({
        productGroupId: editingGroupId ?? undefined,
        page: 1,
        limit: 200,
      }),
  });

  const { data: imagesCatalog = [] } = useAllImages();

  const { data: productImagesAll = [] } = useAllProductImages();

  /**
   * Código de barras já cadastrado carrega o produto existente na tela.
   *
   * Só em cadastro NOVO: na edição o operador já escolheu o produto, e trocá-lo
   * no meio da digitação jogaria fora o que ele preencheu. `openModal` é
   * declaração de função, então já existe aqui — a chamada abaixo é hoisted.
   */
  const { lookupBarcode } = useBarcodeLookup({
    podeCarregar: modalOpen && editingGroupId === null,
    carregarProduto: openModal,
    productGroups: productForm.productGroups,
    categories: productForm.categories,
    departments: productForm.departments,
    tags: productForm.tags,
    productTags: productForm.productTags,
    images: imagesCatalog,
    productImages: productImagesAll,
  });

  const enrichedGroupProducts = useMemo(() => {
    const groupProducts = groupProductsPage?.data ?? [];
    return buildProductCollections({
      products: groupProducts,
      productGroups: productForm.productGroups,
      categories: productForm.categories,
      departments: productForm.departments,
      tags: productForm.tags,
      productTags: productForm.productTags,
      images: imagesCatalog,
      productImages: productImagesAll,
    }).enrichedProducts;
  }, [
    productForm.categories,
    productForm.departments,
    groupProductsPage?.data,
    imagesCatalog,
    productForm.productGroups,
    productImagesAll,
    productForm.productTags,
    productForm.tags,
  ]);

  /**
   * Invalida tudo que reflete um produto salvo, excluído ou reordenado.
   *
   * `RESOURCE_KEYS.products` é o que alcança a TABELA. Desde o item 4.1 ela é uma
   * query só, registrada como `["products","table", params]`; a chave
   * `["product-groups-page"]`, que a listagem em cascata usava, deixou de existir
   * e foi retirada daqui. Invalidar a chave errada não quebra nada visível —
   * compila, roda, e a tela mostra o preço antigo depois de salvar.
   *
   * `["products-by-group", id]` continua na lista porque é a query da MODAL (a
   * lista de variações), não da tabela.
   */
  async function invalidateProductQueries(groupId?: number | null) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.products }),
      queryClient.invalidateQueries({ queryKey: ["products-page"] }),
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.productGroups }),
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.productTags }),
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.productImages }),
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.images }),
      queryClient.invalidateQueries({ queryKey: ["products-by-group", groupId ?? editingGroupId] }),
      queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.tags }),
      queryClient.invalidateQueries({ queryKey: ["product-group-history", groupId ?? editingGroupId] }),
    ]);
  }

  const productVariations = useProductVariations({
    form,
    setForm,
    productEditor,
    variationDrafts,
    setVariationDrafts,
    activeVariationKey,
    setActiveVariationKey,
    defaultStatus: productForm.defaultStatus,
    editingGroupId,
    invalidateProductQueries,
    refetchGroupProducts,
  });

  const productImagesHook = useProductImages({
    setImages,
    activeVariation: productVariations.activeVariation,
    updateVariationDraft: productVariations.updateVariationDraft,
  });

  const productSubmit = useProductSubmit({
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
    productTags: productForm.productTags,
    productImages: productImagesAll,
    getStatusNumber: productForm.getStatusNumber,
    setModalOpen,
    resetForm: productForm.resetForm,
  });

  function toVariationDraft(product: any): VariationDraft {
    return {
      key: `product-${product.id}`,
      id: product.id,
      name: product.name,
      description: product.description || "",
      price: product.price,
      stock: product.stock || 0,
      minStock: product.minStock || 0,
      status: productForm.getStatusIdAsString(product.status),
      tagIds: product.tags.map((tag: any) => tag.id),
      barcode: product.barcode || "",
      // O servidor devolve os valores de grade já na ordem de exibição.
      values: (product.variationValues ?? []).map((value: ProductVariationValueDto) => ({
        gradeType: enumCode(value.gradeType, GRADE_TYPE) as GradeTypeCode,
        value: value.value,
      })),
      images: productImagesHook.toLocalImages(product.images),
      canDelete: product.canDelete,
    };
  }

  function openModal(product?: any) {
    if (product) {
      setEditingGroupId(product.productGroup?.id ?? product.productGroupId);
      setForm({
        departmentId: product.department?.id.toString() ?? "",
        categoryId: product.category?.id.toString() ?? "",
        productGroupName: product.productGroup?.name ?? "",
        description: product.productGroup?.description || "",
        hasVariations: product.productGroup?.hasVariations ?? false,
        isPublic: product.productGroup?.showOnSite ?? true,
      });

      if (product.productGroup?.hasVariations) {
        const draft = toVariationDraft(product);
        setVariationDrafts([draft]);
        setActiveVariationKey(draft.key);
        setProductEditor(createEmptyProductEditor(productForm.defaultStatus));
        setImages([]);
      } else {
        setProductEditor({
          id: product.id,
          name: product.name,
          description: product.description || "",
          price: product.price,
          stock: product.stock || 0,
          minStock: product.minStock || 0,
          status: productForm.getStatusIdAsString(product.status),
          tagIds: product.tags.map((tag: any) => tag.id),
          barcode: product.barcode || "",
        });
        setImages(productImagesHook.toLocalImages(product.images));
        setVariationDrafts([]);
        setActiveVariationKey(null);
      }
    } else {
      productForm.resetForm();
    }
    setModalOpen(true);
  }

  useEffect(() => {
    if (!modalOpen) return;
    setProductEditor((current) =>
      current.status ? current : { ...current, status: productForm.defaultStatus },
    );
  }, [productForm.defaultStatus, modalOpen]);

  useEffect(() => {
    if (!modalOpen || !form.hasVariations) return;
    setVariationDrafts((current) => {
      if (current.length > 0) return current;
      const draft: VariationDraft = {
        ...createEmptyProductEditor(productForm.defaultStatus),
        key: `temp-${Math.random().toString(36).substring(2, 9)}`,
        name: form.productGroupName.trim(),
        images: [],
        canDelete: true,
        values: [],
      };
      setActiveVariationKey(draft.key);
      return [draft];
    });
  }, [productForm.defaultStatus, form.hasVariations, form.productGroupName, modalOpen]);

  useEffect(() => {
    if (
      !modalOpen ||
      !form.hasVariations ||
      !editingGroupId ||
      enrichedGroupProducts.length === 0 ||
      loadedGroupId === editingGroupId
    ) {
      return;
    }

    const drafts = enrichedGroupProducts.map(toVariationDraft);
    setVariationDrafts(drafts);
    setActiveVariationKey((current) => current ?? drafts[0]?.key ?? null);
    setLoadedGroupId(editingGroupId);
  }, [editingGroupId, enrichedGroupProducts, form.hasVariations, modalOpen, loadedGroupId]);

  return {
    modalOpen,
    setModalOpen,
    form,
    setForm,
    productEditor,
    setProductEditor,
    variationDrafts,
    activeVariationKey,
    setActiveVariationKey,
    activeVariation: productVariations.activeVariation,
    images,
    setImages,
    saving,
    departments: productForm.departments,
    categories: productForm.categories,
    filteredCategories: productForm.filteredCategories,
    tags: productForm.tags,
    statusOptions: productForm.statusOptions,
    selectableStatusOptions: productForm.selectableStatusOptions,
    isFetchingGroupProducts,
    editingGroupId,
    openModal,
    lookupBarcode,
    resetForm: productForm.resetForm,
    registerTag: productForm.registerTag,
    updateVariationDraft: productVariations.updateVariationDraft,

    moveProductImage: productImagesHook.moveProductImage,
    reorderProductImage: productImagesHook.reorderProductImage,
    handleSimpleFileSelection: productImagesHook.handleSimpleFileSelection,
    handleVariationFileSelection: productImagesHook.handleVariationFileSelection,
    toggleHasVariations: productForm.toggleHasVariations,
    addVariationDraft: productVariations.addVariationDraft,
    handleDeleteVariation: productVariations.handleDeleteVariation,
    handleDeleteProductGroup: productForm.handleDeleteProductGroup,
    handleSubmit: productSubmit.handleSubmit,
    toLocalImages: productImagesHook.toLocalImages,
    selectedGrades,
    generateVariationsMatrix: productVariations.generateVariationsMatrix,
  };
}

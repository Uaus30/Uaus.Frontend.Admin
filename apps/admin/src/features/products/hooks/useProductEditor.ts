import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getProductsPage, getAllProductGroups, getAllProductImages } from "@/services/products.service";
import { getAllImages } from "@/services/images.service";
import { buildProductCollections } from "@/services/mappers";
import type { LocalImage, ProductGroupForm, ProductEditorForm, VariationDraft, Grade } from "../types";
import { createEmptyProductEditor } from "./editor/utils";

import { useProductForm } from "./editor/useProductForm";
import { useProductVariations } from "./editor/useProductVariations";
import { useProductImages } from "./editor/useProductImages";
import { useProductSubmit } from "./editor/useProductSubmit";

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
  const [activeGrades, setActiveGrades] = useState<Grade[]>([]);

  const matrixGeneratedForCategoryRef = useRef<string | null>(null);

  const productForm = useProductForm({
    form,
    setForm,
    productEditor,
    setProductEditor,
    setEditingGroupId,
    setLoadedGroupId,
    setActiveVariationKey,
    matrixGeneratedForCategoryRef,
    setVariationDrafts,
    setImages,
    setActiveGrades
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

  const { data: imagesCatalog = [] } = useQuery({
    queryKey: ["images-all-for-products"],
    queryFn: () => getAllImages(),
  });

  const { data: productImagesAll = [] } = useQuery({
    queryKey: ["product-images-all-for-products"],
    queryFn: () => getAllProductImages(),
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

  async function invalidateProductQueries(groupId?: number | null) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products-page"] }),
      queryClient.invalidateQueries({ queryKey: ["product-groups-all-for-products"] }),
      queryClient.invalidateQueries({ queryKey: ["product-groups-page"] }),
      queryClient.invalidateQueries({ queryKey: ["product-tags-all-for-products"] }),
      queryClient.invalidateQueries({ queryKey: ["product-images-all-for-products"] }),
      queryClient.invalidateQueries({ queryKey: ["images-all-for-products"] }),
      queryClient.invalidateQueries({ queryKey: ["products-by-group", groupId ?? editingGroupId] }),
      queryClient.invalidateQueries({ queryKey: ["tags-all-for-products"] }),
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
    gradesList: productForm.gradesList,
    setActiveGrades,
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
    activeGrades,
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
      const draft = { ...createEmptyProductEditor(productForm.defaultStatus), key: `temp-${Math.random().toString(36).substring(2, 9)}`, name: form.productGroupName.trim(), images: [], canDelete: true } as VariationDraft;
      setActiveVariationKey(draft.key);
      return [draft];
    });
  }, [productForm.defaultStatus, form.hasVariations, form.productGroupName, modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    if (!form.categoryId || productForm.categoryGrades.length === 0) {
      return;
    }
    setActiveGrades(productForm.categoryGrades);

    if (editingGroupId != null) return;
    if (productForm.gradesList.length === 0) return;

    const hasPersistedDraft = variationDrafts.some((draft) => draft.id != null);
    if (hasPersistedDraft) return;
    if (matrixGeneratedForCategoryRef.current === form.categoryId) return;

    if (form.hasVariations && variationDrafts.length <= 1) {
      matrixGeneratedForCategoryRef.current = form.categoryId;
      const gradeIds = productForm.categoryGrades.map((g: Grade) => g.id);
      productVariations.generateVariationsMatrix(gradeIds);
    }
  }, [
    productForm.categoryGrades,
    editingGroupId,
    form.categoryId,
    form.hasVariations,
    productForm.gradesList.length,
    modalOpen,
    variationDrafts,
    productVariations,
  ]);

  useEffect(() => {
    if (
      !modalOpen
      || !form.hasVariations
      || !editingGroupId
      || enrichedGroupProducts.length === 0
      || loadedGroupId === editingGroupId
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
    activeGrades,
    generateVariationsMatrix: productVariations.generateVariationsMatrix,
    gradesList: productForm.gradesList,
    categoryGrades: productForm.categoryGrades,
  };
}

import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useGetGrades, type TagDto, type GradeDto } from "@workspace/api-client-react";
import { getEnumOptions, buildPublicImageUrl } from "@/services/core";
import { buildProductCollections } from "@/services/mappers";
import { getAllCategories, getAllDepartments } from "@/services/categories.service";
import { getAllImages, createImageFromFile } from "@/services/images.service";
import {
  getAllProductGroups,
  getAllProductImages,
  getAllProductTags,
  getProductsPage,
  createProductGroup,
  updateProductGroup,
  upsertProduct,
  deleteProduct,
  deleteProductGroup,
  syncProductTags,
  syncProductImages,
} from "@/services/products.service";
import { getAllTags } from "@/services/tags.service";
import { getGradesByCategoryId } from "@/services/grades.service";
import type { ProductGroupForm, ProductEditorForm, LocalImage, VariationDraft, Grade } from "../types";

function mapDtoToGrade(dto: GradeDto, typeMap: Record<number | string, any>): Grade {
  return {
    id: dto.id,
    name: dto.name,
    type: typeMap[dto.type] || "Tamanho",
    categoryIds: dto.categoryIds || [],
    variants: dto.options.map((opt: any) => ({
      id: opt.id,
      value: opt.value,
      colorHex: opt.colorHex || undefined,
      order: opt.displayOrder
    }))
  };
}

function createDraftKey() {
  return `draft-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyProductEditor(defaultStatus = "", baseName = ""): ProductEditorForm {
  return {
    id: null,
    name: baseName,
    price: 0,
    stock: 0,
    minStock: 0,
    status: defaultStatus,
    tagIds: [],
    barcode: "",
  };
}

function createVariationDraft(defaultStatus = "", baseName = ""): VariationDraft {
  return {
    key: createDraftKey(),
    id: null,
    name: baseName,
    price: 0,
    stock: 0,
    minStock: 0,
    status: defaultStatus,
    tagIds: [],
    barcode: "",
    images: [],
    canDelete: true,
    variantMap: {},
  };
}

function reorderItems<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;

  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(nextIndex, 0, item);
  return copy;
}

function moveItemTo<T>(items: T[], oldIndex: number, newIndex: number) {
  if (oldIndex < 0 || oldIndex >= items.length || newIndex < 0 || newIndex >= items.length) return items;
  const copy = [...items];
  const [item] = copy.splice(oldIndex, 1);
  copy.splice(newIndex, 0, item);
  return copy;
}

export function useProductEditor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const { data: departments = [] } = useQuery({
    queryKey: ["departments-all-for-products"],
    queryFn: () => getAllDepartments(),
  });

  const { data: gradeTypeOptions = [] } = useQuery({
    queryKey: ["grade-type-options"],
    queryFn: () => getEnumOptions("/Grades/enums/grade-type"),
  });

  const typeMapFromApi = useMemo(() => {
    const map: Record<number | string, any> = {
      1: "Tamanho",
      2: "Cor",
      3: "Modelo",
      4: "Estampa",
      "Size": "Tamanho",
      "Color": "Cor",
      "Model": "Modelo",
      "Print": "Estampa",
      "size": "Tamanho",
      "color": "Cor",
      "model": "Modelo",
      "print": "Estampa",
    };
    gradeTypeOptions.forEach(opt => {
      map[opt.id] = opt.name;
      map[opt.value] = opt.name;
      map[opt.value.toLowerCase()] = opt.name;
    });
    return map;
  }, [gradeTypeOptions]);

  const { data: apiGrades = [] } = useGetGrades();
  const gradesList = useMemo(() => apiGrades.map((g) => mapDtoToGrade(g, typeMapFromApi)), [apiGrades, typeMapFromApi]);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-all-for-products"],
    queryFn: () => getAllCategories(),
  });

  const { data: categoryGradesRaw = [] } = useQuery({
    queryKey: ["grades-by-category", form.categoryId],
    queryFn: () => getGradesByCategoryId(Number(form.categoryId)),
    enabled: !!form.categoryId,
  });

  const categoryGrades = useMemo(() => {
    return categoryGradesRaw.map(g => mapDtoToGrade(g, typeMapFromApi));
  }, [categoryGradesRaw, typeMapFromApi]);

  const { data: productGroups = [] } = useQuery({
    queryKey: ["product-groups-all-for-products"],
    queryFn: () => getAllProductGroups(),
  });

  const { data: tags = [] } = useQuery({
    queryKey: ["tags-all-for-products"],
    queryFn: () => getAllTags(),
  });

  const { data: productTags = [] } = useQuery({
    queryKey: ["product-tags-all-for-products"],
    queryFn: () => getAllProductTags(),
  });

  const { data: productImages = [] } = useQuery({
    queryKey: ["product-images-all-for-products"],
    queryFn: () => getAllProductImages(),
  });

  const { data: imagesCatalog = [] } = useQuery({
    queryKey: ["images-all-for-products"],
    queryFn: () => getAllImages(),
  });

  const { data: statusOptions = [] } = useQuery({
    queryKey: ["product-status-options"],
    queryFn: () => getEnumOptions("/Products/enums/product-status"),
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

  const selectableStatusOptions = useMemo(
    () => statusOptions.filter((item) => item.allowSelect),
    [statusOptions],
  );

  const defaultStatus = "";

  const enrichedGroupProducts = useMemo(() => {
    const groupProducts = groupProductsPage?.data ?? [];
    return buildProductCollections({
      products: groupProducts,
      productGroups,
      categories,
      departments,
      tags,
      productTags,
      images: imagesCatalog,
      productImages,
    }).enrichedProducts;
  }, [categories, departments, groupProductsPage?.data, imagesCatalog, productGroups, productImages, productTags, tags]);

  const filteredCategories = useMemo(
    () =>
      categories.filter((category) =>
        form.departmentId ? category.departmentId === Number(form.departmentId) : true,
      ),
    [categories, form.departmentId],
  );

  const activeVariation = useMemo(
    () => variationDrafts.find((variation) => variation.key === activeVariationKey) ?? null,
    [activeVariationKey, variationDrafts],
  );

  function toLocalImages(items: any[] = []) {
    return items.map((item: any) => ({
      imageId: item.imageId,
      associationId: item.associationId,
      name: item.image.name,
      url: buildPublicImageUrl(item.image.url),
    }));
  }

  function toVariationDraft(product: any): VariationDraft {
    return {
      key: `product-${product.id}`,
      id: product.id,
      name: product.name,
      description: product.description || "",
      price: product.price,
      stock: product.stock || 0,
      minStock: product.minStock || 0,
      status: String(product.status),
      tagIds: product.tags.map((tag: TagDto) => tag.id),
      barcode: product.barcode || "",
      images: toLocalImages(product.images),
      canDelete: product.canDelete,
    };
  }

  function registerTag(createdTag: TagDto) {
    queryClient.setQueryData<TagDto[] | undefined>(["tags-all-for-products"], (current) => {
      const next = current ?? [];
      if (next.some((tag) => tag.id === createdTag.id)) return next;
      return [...next, createdTag];
    });
    queryClient.invalidateQueries({ queryKey: ["tags-page"] });
  }

  function updateVariationDraft(
    key: string,
    updater: (draft: VariationDraft) => VariationDraft,
  ) {
    setVariationDrafts((current) =>
      current.map((draft) => (draft.key === key ? updater(draft) : draft)),
    );
  }

  function resetForm() {
    setEditingGroupId(null);
    setLoadedGroupId(null);
    setActiveVariationKey(null);
    setForm({
      departmentId: "",
      categoryId: "",
      productGroupName: "",
      description: "",
      hasVariations: false,
      isPublic: true,
    });
    setProductEditor(createEmptyProductEditor(defaultStatus));
    setVariationDrafts([]);
    setImages([]);
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
        isPublic: product.productGroup?.isPublic ?? true,
      });

      if (product.productGroup?.hasVariations) {
        const draft = toVariationDraft(product);
        setVariationDrafts([draft]);
        setActiveVariationKey(draft.key);
        setProductEditor(createEmptyProductEditor(defaultStatus));
        setImages([]);
      } else {
        setProductEditor({
          id: product.id,
          name: product.name,
          description: product.description || "",
          price: product.price,
          stock: product.stock || 0,
          minStock: product.minStock || 0,
          status: String(product.status),
          tagIds: product.tags.map((tag: TagDto) => tag.id),
          barcode: product.barcode || "",
        });
        setImages(toLocalImages(product.images));
        setVariationDrafts([]);
        setActiveVariationKey(null);
      }
    } else {
      resetForm();
    }

    setModalOpen(true);
  }

  function toggleHasVariations(checked: boolean) {
    setForm(current => ({ ...current, hasVariations: checked }));
    
    if (checked) {
      // Start with empty table as requested
      setVariationDrafts([]);
      setActiveVariationKey(null);
      setActiveGrades([]);
    } else {
      setVariationDrafts([]);
      setActiveVariationKey(null);
      setActiveGrades([]);
    }
  }

  function generateVariationsMatrix(selectedGradeIds: number[]) {
    // Get the full Grade objects from mock/system
    const selectedGrades = gradesList.filter((g: Grade) => selectedGradeIds.includes(g.id));
    setActiveGrades(selectedGrades);

    if (selectedGrades.length === 0) {
      const draftName = productEditor.name || form.productGroupName;
      const draft = createVariationDraft(defaultStatus, draftName);
      draft.price = productEditor.price;
      draft.stock = 0;
      draft.minStock = productEditor.minStock;
      draft.barcode = productEditor.barcode;
      draft.variantMap = {};
      
      setVariationDrafts([draft]);
      setForm(current => ({ ...current, hasVariations: true }));
      setActiveVariationKey(draft.key);
      return;
    }

    // Cartesian product of variants
    const generateCombinations = (gradesList: Grade[], currentMap: Record<number, number> = {}, index = 0): Record<number, number>[] => {
      if (index === gradesList.length) {
        return [{ ...currentMap }];
      }
      const grade = gradesList[index];
      const combinations: Record<number, number>[] = [];
      for (const variant of grade.variants) {
        currentMap[grade.id] = variant.id;
        combinations.push(...generateCombinations(gradesList, currentMap, index + 1));
      }
      return combinations;
    };

    const newCombinations = generateCombinations(selectedGrades);
    
    const newDrafts: VariationDraft[] = newCombinations.map(combo => {
      // Create draft name based on variants
      const comboNames = selectedGrades.map((g: Grade) => {
        const variantId = combo[g.id];
        return g.variants.find((v: any) => v.id === variantId)?.value;
      }).filter(Boolean);
      
      const draftName = `${productEditor.name || form.productGroupName} ${comboNames.join(" ")}`.trim();
      
      const draft = createVariationDraft(defaultStatus, draftName);
      draft.price = productEditor.price;
      draft.stock = 0; // Forced to be filled
      draft.minStock = productEditor.minStock;
      draft.barcode = productEditor.barcode;
      draft.variantMap = combo;
      return draft;
    });

    setVariationDrafts(newDrafts);
    setForm(current => ({ ...current, hasVariations: newDrafts.length > 0 }));
    if (newDrafts.length > 0) setActiveVariationKey(newDrafts[0].key);
  }

  useEffect(() => {
    if (!modalOpen) return;

    setProductEditor((current) =>
      current.status ? current : { ...current, status: defaultStatus },
    );
  }, [defaultStatus, modalOpen]);

  useEffect(() => {
    // Only auto-initialize if it's empty and modal just opened with variations enabled by the backend
    if (!modalOpen || !form.hasVariations) return;

    setVariationDrafts((current) => {
      if (current.length > 0) return current;
      const draft = createVariationDraft(defaultStatus, form.productGroupName.trim());
      setActiveVariationKey(draft.key);
      return [draft];
    });
  }, [defaultStatus, form.hasVariations, form.productGroupName, modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    if (!form.categoryId || categoryGrades.length === 0) {
      return;
    }

    // Automatically set the active grades to the ones linked with the selected category
    setActiveGrades(categoryGrades);
    
    // Automatically generate variation drafts if variations are enabled and there are no drafts yet
    if (form.hasVariations && variationDrafts.length <= 1) {
      const gradeIds = categoryGrades.map(g => g.id);
      generateVariationsMatrix(gradeIds);
    }
  }, [categoryGrades, form.hasVariations, modalOpen, categoryGrades.length, variationDrafts.length]);

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

  function handleSimpleFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const fileList = Array.from(event.target.files ?? []);
    const nextImages = fileList.map((file) => ({
      name: file.name.replace(/\.[^/.]+$/, ""),
      url: URL.createObjectURL(file),
      file,
    }));
    setImages((current) => [...current, ...nextImages]);
  }

  function handleVariationFileSelection(event: React.ChangeEvent<HTMLInputElement>) {
    if (!activeVariation) return;

    const fileList = Array.from(event.target.files ?? []);
    const nextImages = fileList.map((file) => ({
      name: file.name.replace(/\.[^/.]+$/, ""),
      url: URL.createObjectURL(file),
      file,
    }));

    updateVariationDraft(activeVariation.key, (draft) => ({
      ...draft,
      images: [...draft.images, ...nextImages],
    }));
  }

  async function invalidateProductQueries(groupId?: number | null) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["products-page"] }),
      queryClient.invalidateQueries({ queryKey: ["product-groups-all-for-products"] }),
      queryClient.invalidateQueries({ queryKey: ["product-tags-all-for-products"] }),
      queryClient.invalidateQueries({ queryKey: ["product-images-all-for-products"] }),
      queryClient.invalidateQueries({ queryKey: ["images-all-for-products"] }),
      queryClient.invalidateQueries({ queryKey: ["products-by-group", groupId ?? editingGroupId] }),
      queryClient.invalidateQueries({ queryKey: ["tags-all-for-products"] }),
      queryClient.invalidateQueries({ queryKey: ["products-all-for-table"] }),
    ]);
  }

  async function persistGroup() {
    if (!form.categoryId || !form.productGroupName.trim()) {
      throw new Error("Preencha categoria e nome do produto pai.");
    }

    if (editingGroupId) {
      const updatedGroup = await updateProductGroup({
        id: editingGroupId,
        categoryId: Number(form.categoryId),
        name: form.productGroupName,
        hasVariations: form.hasVariations,
      });
      return updatedGroup;
    }

    const createdGroup = await createProductGroup({
      categoryId: Number(form.categoryId),
      name: form.productGroupName,
      hasVariations: form.hasVariations,
    });
    setEditingGroupId(createdGroup.id);
    return createdGroup;
  }

  async function persistProductAssociations(
    productId: number,
    tagIds: number[],
    sourceImages: LocalImage[],
  ) {
    const currentTagAssociations = productTags.filter((item) => item.productId === productId);
    await syncProductTags({
      productId,
      currentAssociations: currentTagAssociations,
      nextTagIds: tagIds,
    });

    const persistedNewImages = [];
    for (const image of sourceImages) {
      if (image.imageId || !image.file) continue;
      const created = await createImageFromFile({
        file: image.file,
        name: image.name,
        type: 3,
      });
      persistedNewImages.push({
        ...image,
        imageId: created.id,
        url: buildPublicImageUrl(created.url),
      });
    }

    const normalizedImages = sourceImages
      .filter((image) => image.imageId)
      .concat(persistedNewImages);

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

  function addVariationDraft(initialValues?: Partial<VariationDraft>) {
    const draft = createVariationDraft(defaultStatus, initialValues?.name || productEditor.name || form.productGroupName.trim());
    draft.price = initialValues?.price ?? productEditor.price;
    draft.minStock = initialValues?.minStock ?? productEditor.minStock;
    draft.barcode = initialValues?.barcode ?? productEditor.barcode;
    draft.stock = initialValues?.stock ?? 0;
    if (initialValues?.variantMap) draft.variantMap = initialValues.variantMap;
    if (initialValues?.status) draft.status = initialValues.status;
    
    setVariationDrafts((current) => {
      const newDrafts = [...current, draft];
      setForm(f => ({ ...f, hasVariations: true }));
      return newDrafts;
    });
    setActiveVariationKey(draft.key);
  }

  async function handleDeleteVariation(draft: VariationDraft) {
    if (draft.id == null || draft.id === 0) {
      const nextDrafts = variationDrafts.filter((item) => item.key !== draft.key);
      setVariationDrafts(nextDrafts);
      setForm(f => ({ ...f, hasVariations: nextDrafts.length > 0 }));
      if (activeVariationKey === draft.key) {
        setActiveVariationKey(nextDrafts[0]?.key ?? null);
      }
      return;
    }

    try {
      await deleteProduct(draft.id);
      await invalidateProductQueries(editingGroupId);
      await refetchGroupProducts();

      const nextDrafts = variationDrafts.filter((item) => item.key !== draft.key);
      setVariationDrafts(nextDrafts);
      setForm(f => ({ ...f, hasVariations: nextDrafts.length > 0 }));
      if (activeVariationKey === draft.key) {
        setActiveVariationKey(nextDrafts[0]?.key ?? null);
      }

      toast({ title: "Variação removida." });
    } catch (error) {
      toast({
        title: "Erro ao remover variação",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
        error,
      });
    }
  }

  async function handleDeleteProductGroup(productGroupId: number) {
    try {
      await deleteProductGroup(productGroupId);
      await invalidateProductQueries(productGroupId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product-groups-page"] }),
        queryClient.invalidateQueries({ queryKey: ["products-all-for-table"] }),
      ]);
      toast({ title: "Produto removido com sucesso." });
    } catch (error) {
      toast({
        title: "Erro ao remover produto",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
        error,
      });
    }
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
          status: Number(productEditor.status),
        });

        const normalizedImages = await persistProductAssociations(
          product.id,
          productEditor.tagIds,
          images,
        );

        setProductEditor((current) => ({ ...current, id: product.id }));
        setImages(normalizedImages);
      } else {
        if (variationDrafts.length < 2) {
          throw new Error("O cadastro com variações deve ter no mínimo duas variações.");
        }

        if (activeGrades.length > 0) {
          const combinations = new Set();
          for (const draft of variationDrafts) {
            const comboStr = JSON.stringify(draft.variantMap || {});
            if (combinations.has(comboStr)) {
              throw new Error("Existem variações com as mesmas combinações de grades selecionadas. Remova a duplicidade para continuar.");
            }
            combinations.add(comboStr);
          }
        } else {
          const names = new Set();
          for (const draft of variationDrafts) {
            const nameKey = draft.name.trim().toUpperCase();
            if (names.has(nameKey)) {
              throw new Error(`Existem variações com o mesmo nome ("${draft.name.trim()}"). Como não há grades selecionadas, cada variação deve ter um nome único.`);
            }
            names.add(nameKey);
          }
        }

        const nextDrafts: VariationDraft[] = [];
        for (const draft of variationDrafts) {
          if (!draft.name.trim() || !draft.status) {
            throw new Error("Preencha nome e status em todas as variações.");
          }

          const product = await upsertProduct({
            id: draft.id,
            productGroupId: group.id,
            name: draft.name,
            description: draft.description,
            barcode: draft.barcode,
            price: draft.price,
            minStock: draft.minStock,
            status: Number(draft.status),
            gradeOptionIds: Object.values(draft.variantMap || {}),
          });

          const normalizedImages = await persistProductAssociations(
            product.id,
            draft.tagIds,
            draft.images,
          );

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
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
        error,
      });
    } finally {
      setSaving(false);
    }
  }

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
    activeVariation,
    images,
    setImages,
    saving,
    departments,
    categories,
    filteredCategories,
    tags,
    statusOptions,
    selectableStatusOptions,
    isFetchingGroupProducts,
    editingGroupId,
    openModal,
    resetForm,
    registerTag,
    updateVariationDraft,

    moveProductImage,
    reorderProductImage,
    handleSimpleFileSelection,
    handleVariationFileSelection,
    toggleHasVariations,
    addVariationDraft,
    handleDeleteVariation,
    handleDeleteProductGroup,
    handleSubmit,
    toLocalImages,
    activeGrades,
    generateVariationsMatrix,
    gradesList,
    categoryGrades
  };
}

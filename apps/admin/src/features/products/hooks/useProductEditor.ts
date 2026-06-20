import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getEnumOptions, buildPublicImageUrl } from "@/services/core";
import {
  getAllProducts,
  getAllProductImages,
  getAllProductTags,
  getProductsPage,
  createProductGroup,
  updateProductGroup,
  upsertProduct,
  syncProductTags,
  syncProductImages,
  deleteProduct,
  deleteProductGroup,
} from "@/services/products.service";
import { getAllCategories, getAllDepartments } from "@/services/categories.service";
import { getGradesByCategoryId, getAllGrades } from "@/services/grades.service";
import { getAllTags } from "@/services/tags.service";
import { getAllImages, createImageFromFile } from "@/services/images.service";
import { buildProductCollections } from "@/services/mappers";
import type { LocalImage, ProductGroupForm, ProductEditorForm, VariationDraft, Grade } from "../types";
import type { TagDto } from "@workspace/api-client-react";
import { optimizeImage } from "@/lib/imageOptimizer";

/**
 * Helper: Reorders an array by shifting an item at `index` left (-1) or right (+1).
 */
function reorderItems<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const copy = [...list];
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= copy.length) return copy;
  const temp = copy[index];
  copy[index] = copy[nextIndex];
  copy[nextIndex] = temp;
  return copy;
}

/**
 * Helper: Moves an array item from a source index to a destination index.
 */
function moveItemTo<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...list];
  const [removed] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, removed);
  return copy;
}

/**
 * Mapper: Converts a raw DTO from the API into a strongly-typed `Grade` model.
 */
function mapDtoToGrade(dto: any, typeMap: Record<number | string, any>): Grade {
  return {
    id: dto.id,
    name: dto.name,
    type: typeMap[dto.type] || "Tamanho",
    categoryIds: dto.categoryIds || [],
    variants: (dto.variants || []).map((v: any) => ({
      id: v.id,
      value: v.value,
      colorHex: v.colorHex || undefined,
      order: v.order || 0,
    })),
  };
}

/**
 * Helper: Factory to instantiate an empty ProductEditorForm template.
 */
function createEmptyProductEditor(defaultStatus = ""): ProductEditorForm {
  return {
    id: null,
    name: "",
    description: "",
    price: 0,
    stock: 0,
    minStock: 0,
    status: defaultStatus,
    tagIds: [],
    barcode: "",
  };
}

/**
 * Helper: Factory to instantiate a new VariationDraft layout.
 */
function createVariationDraft(defaultStatus = "", name = ""): VariationDraft {
  const empty = createEmptyProductEditor(defaultStatus);
  return {
    ...empty,
    key: `temp-${Math.random().toString(36).substring(2, 9)}`,
    name,
    images: [],
    canDelete: true,
  };
}

/**
 * useProductEditor
 * 
 * Orchestrator hook for managing the state, validation, and API updates of the Product Editor modal.
 * Designed to separate UI logic from API calls and business validations.
 * 
 * Core responsibilities:
 * - Simple Product vs Variation Product states
 * - Fetching option sets (Departments, Categories, Grades, Tags, Images Catalog, Status Enums)
 * - Handling multi-image selection, drag-and-drop sorting, and catalog upload
 * - Implementing cartesian product matrix generation for selected grades
 * - Syncing relational associations (Tags, Images) incrementally with backend
 * - Submitting form payloads with optimistic state invalidation
 */
export function useProductEditor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Dialog Visibility states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [loadedGroupId, setLoadedGroupId] = useState<number | null>(null);
  const [activeVariationKey, setActiveVariationKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // local states for media/forms
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

  // React Queries: Option sets & catalog resources
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

  const { data: apiGrades = [] } = useQuery({
    queryKey: ["grades-all-for-products"],
    queryFn: () => getAllGrades(),
  });
  const gradesList = useMemo(() => apiGrades.map((g: any) => mapDtoToGrade(g, typeMapFromApi)), [apiGrades, typeMapFromApi]);

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
    return categoryGradesRaw.map((g: any) => mapDtoToGrade(g, typeMapFromApi));
  }, [categoryGradesRaw, typeMapFromApi]);

  const { data: productGroups = [] } = useQuery({
    queryKey: ["product-groups-all-for-products"],
    queryFn: () => import("@/services/products.service").then(m => m.getAllProductGroups()),
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

  /**
   * Helper: Resolves dynamic enum status payload into string identifier.
   */
  const getStatusIdAsString = (statusVal: any): string => {
    if (statusVal === undefined || statusVal === null) return "";
    const statusStr = String(statusVal);
    const byId = statusOptions.find(opt => String(opt.id) === statusStr);
    if (byId) return String(byId.id);
    const byValue = statusOptions.find(opt => opt.value.toLowerCase() === statusStr.toLowerCase());
    if (byValue) return String(byValue.id);
    const byName = statusOptions.find(opt => opt.name.toLowerCase() === statusStr.toLowerCase());
    if (byName) return String(byName.id);
    return statusStr;
  };

  /**
   * Helper: Resolves dynamic enum status input into numeric identifier.
   */
  const getStatusNumber = (statusVal: any): number => {
    if (statusVal === undefined || statusVal === null) return 0;
    const statusStr = String(statusVal);
    const option = statusOptions.find(
      opt =>
        String(opt.id) === statusStr ||
        opt.value.toLowerCase() === statusStr.toLowerCase() ||
        opt.name.toLowerCase() === statusStr.toLowerCase()
    );
    return option ? option.id : Number(statusVal);
  };

  /** Resolves the default status ID matching "Ativo" */
  const defaultStatus = useMemo(() => {
    const activeOpt = statusOptions.find(
      (opt) => opt.name.toLowerCase() === "ativo" || opt.value.toLowerCase() === "ativo"
    );
    return activeOpt ? String(activeOpt.id) : "";
  }, [statusOptions]);

  /** Product instances under the editing group, fully enriched with associations */
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

  /** Categories filtered to only show those belonging to the currently selected department */
  const filteredCategories = useMemo(
    () =>
      categories.filter((category) =>
        form.departmentId ? category.departmentId === Number(form.departmentId) : true,
      ),
    [categories, form.departmentId],
  );

  /** Active variation draft object currently focused */
  const activeVariation = useMemo(
    () => variationDrafts.find((variation) => variation.key === activeVariationKey) ?? null,
    [activeVariationKey, variationDrafts],
  );

  /** Maps raw backend images into local frontend image shapes */
  function toLocalImages(items: any[] = []) {
    return items.map((item: any) => ({
      imageId: item.imageId,
      associationId: item.associationId,
      name: item.image.name,
      url: buildPublicImageUrl(item.image.url),
    }));
  }

  /** Maps product model properties into a table draft item */
  function toVariationDraft(product: any): VariationDraft {
    return {
      key: `product-${product.id}`,
      id: product.id,
      name: product.name,
      description: product.description || "",
      price: product.price,
      stock: product.stock || 0,
      minStock: product.minStock || 0,
      status: getStatusIdAsString(product.status),
      tagIds: product.tags.map((tag: any) => tag.id),
      barcode: product.barcode || "",
      images: toLocalImages(product.images),
      canDelete: product.canDelete,
    };
  }

  /** Optimistic tag registration callback */
  function registerTag(createdTag: TagDto) {
    queryClient.setQueryData<TagDto[] | undefined>(["tags-all-for-products"], (current) => {
      const next = current ?? [];
      if (next.some((tag) => tag.id === createdTag.id)) return next;
      return [...next, createdTag];
    });
    queryClient.invalidateQueries({ queryKey: ["tags-page"] });
  }

  /** Updates attributes inside a single variation draft in the array */
  function updateVariationDraft(
    key: string,
    updater: (draft: VariationDraft) => VariationDraft,
  ) {
    setVariationDrafts((current) =>
      current.map((draft) => (draft.key === key ? updater(draft) : draft)),
    );
  }

  /** Resets hook forms and selections to pristine state */
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

  /** Prepares form states and opens modal for create (no arguments) or edit (product object provided) */
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
          status: getStatusIdAsString(product.status),
          tagIds: product.tags.map((tag: any) => tag.id),
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

  /** Toggles variation editing flow on/off */
  function toggleHasVariations(checked: boolean) {
    setForm(current => ({ ...current, hasVariations: checked }));
    setVariationDrafts([]);
    setActiveVariationKey(null);
    setActiveGrades([]);
  }

  /**
   * Generates a cartesian cross-combination matrix from selected grade options.
   * Maps combinations into SKU drafts and updates local drafts list.
   */
  function generateVariationsMatrix(selectedGradeIds: number[]) {
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

    // Cartesian product recursion
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
      const comboNames = selectedGrades.map((g: Grade) => {
        const variantId = combo[g.id];
        return g.variants.find((v: any) => v.id === variantId)?.value;
      }).filter(Boolean);
      
      const draftName = `${productEditor.name || form.productGroupName} ${comboNames.join(" ")}`.trim();
      
      const draft = createVariationDraft(defaultStatus, draftName);
      draft.price = productEditor.price;
      draft.stock = 0;
      draft.minStock = productEditor.minStock;
      draft.barcode = productEditor.barcode;
      draft.variantMap = combo;
      return draft;
    });

    setVariationDrafts(newDrafts);
    setForm(current => ({ ...current, hasVariations: newDrafts.length > 0 }));
    if (newDrafts.length > 0) setActiveVariationKey(newDrafts[0].key);
  }

  // Side Effect: Setup simple status once status list resolves
  useEffect(() => {
    if (!modalOpen) return;
    setProductEditor((current) =>
      current.status ? current : { ...current, status: defaultStatus },
    );
  }, [defaultStatus, modalOpen]);

  // Side Effect: Auto-populate variations array if enabled and empty
  useEffect(() => {
    if (!modalOpen || !form.hasVariations) return;
    setVariationDrafts((current) => {
      if (current.length > 0) return current;
      const draft = createVariationDraft(defaultStatus, form.productGroupName.trim());
      setActiveVariationKey(draft.key);
      return [draft];
    });
  }, [defaultStatus, form.hasVariations, form.productGroupName, modalOpen]);

  // Side Effect: Auto-resolve grades matching selected category
  useEffect(() => {
    if (!modalOpen) return;
    if (!form.categoryId || categoryGrades.length === 0) {
      return;
    }
    setActiveGrades(categoryGrades);
    if (form.hasVariations && variationDrafts.length <= 1) {
      const gradeIds = categoryGrades.map((g: Grade) => g.id);
      generateVariationsMatrix(gradeIds);
    }
  }, [categoryGrades, form.hasVariations, modalOpen, categoryGrades.length, variationDrafts.length]);

  // Side Effect: Load active group variations into edit layout when retrieved from API
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

    setImages((current) => [...current, ...nextImages]);
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
      images: [...draft.images, ...nextImages],
    }));
  }

  /** Invalidation queue to clear product catalog caching */
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
      queryClient.invalidateQueries({ queryKey: ["products-all-for-table"] }),
      queryClient.invalidateQueries({ queryKey: ["product-group-history", groupId ?? editingGroupId] }),
    ]);
  }

  /** Persists ProductGroup wrapper to DB */
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

  /** Sincroniza incrementalmente tags e imagens selecionadas para um produto específico */
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

  /** Validates rules and upserts payload to backend database */
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
            status: getStatusNumber(draft.status),
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

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { getEnumOptions } from "@/services/core";
import { getAllCategories, getAllDepartments } from "@/services/categories.service";
import { getGradesByCategoryId, getAllGrades } from "@/services/grades.service";
import { getAllTags } from "@/services/tags.service";
import { getAllProductTags, deleteProductGroup } from "@/services/products.service";
import { mapDtoToGrade, createEmptyProductEditor } from "./utils";
import type { ProductGroupForm, ProductEditorForm, Grade, LocalImage } from "../../types";
import type { TagDto } from "@workspace/api-client-react";

export interface UseProductFormProps {
  form: ProductGroupForm;
  setForm: React.Dispatch<React.SetStateAction<ProductGroupForm>>;
  productEditor: ProductEditorForm;
  setProductEditor: React.Dispatch<React.SetStateAction<ProductEditorForm>>;
  setEditingGroupId: React.Dispatch<React.SetStateAction<number | null>>;
  setLoadedGroupId: React.Dispatch<React.SetStateAction<number | null>>;
  setActiveVariationKey: React.Dispatch<React.SetStateAction<string | null>>;
  matrixGeneratedForCategoryRef: React.MutableRefObject<string | null>;
  setVariationDrafts: React.Dispatch<React.SetStateAction<any[]>>;
  setImages: React.Dispatch<React.SetStateAction<LocalImage[]>>;
  setActiveGrades: React.Dispatch<React.SetStateAction<Grade[]>>;
}

export function useProductForm({
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
}: UseProductFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
      1: "Tamanho", 2: "Cor", 3: "Modelo", 4: "Estampa",
      "Size": "Tamanho", "Color": "Cor", "Model": "Modelo", "Print": "Estampa",
      "size": "Tamanho", "color": "Cor", "model": "Modelo", "print": "Estampa",
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

  const { data: statusOptions = [] } = useQuery({
    queryKey: ["product-status-options"],
    queryFn: () => getEnumOptions("/Products/enums/product-status"),
  });

  const selectableStatusOptions = useMemo(
    () => statusOptions.filter((item) => item.allowSelect),
    [statusOptions],
  );

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

  const defaultStatus = useMemo(() => {
    const activeOpt = statusOptions.find(
      (opt) => opt.name.toLowerCase() === "ativo" || opt.value.toLowerCase() === "ativo"
    );
    return activeOpt ? String(activeOpt.id) : "";
  }, [statusOptions]);

  const filteredCategories = useMemo(
    () =>
      categories.filter((category) =>
        form.departmentId ? category.departmentId === Number(form.departmentId) : true,
      ),
    [categories, form.departmentId],
  );

  function registerTag(createdTag: TagDto) {
    queryClient.setQueryData<TagDto[] | undefined>(["tags-all-for-products"], (current) => {
      const next = current ?? [];
      if (next.some((tag) => tag.id === createdTag.id)) return next;
      return [...next, createdTag];
    });
    queryClient.invalidateQueries({ queryKey: ["tags-page"] });
  }

  function resetForm() {
    setEditingGroupId(null);
    setLoadedGroupId(null);
    setActiveVariationKey(null);
    matrixGeneratedForCategoryRef.current = null;
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

  function toggleHasVariations(checked: boolean) {
    setForm(current => ({ ...current, hasVariations: checked }));
    setVariationDrafts([]);
    setActiveVariationKey(null);
    setActiveGrades([]);
    matrixGeneratedForCategoryRef.current = null;
  }

  async function handleDeleteProductGroup(productGroupId: number) {
    try {
      await deleteProductGroup(productGroupId);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["product-groups-all-for-products"] }),
        queryClient.invalidateQueries({ queryKey: ["products-page"] }),
        queryClient.invalidateQueries({ queryKey: ["product-groups-page"] }),
        queryClient.invalidateQueries({ queryKey: ["products-by-group", productGroupId] }),
        queryClient.invalidateQueries({ queryKey: ["product-group-history", productGroupId] }),
      ]);
      toast({ title: "Produto removido com sucesso." });
    } catch (error) {
      toast({
        title: "Erro ao remover produto",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    }
  }

  return {
    departments,
    categories,
    filteredCategories,
    tags,
    productTags,
    statusOptions,
    selectableStatusOptions,
    defaultStatus,
    getStatusIdAsString,
    getStatusNumber,
    gradesList,
    categoryGrades,
    productGroups,
    registerTag,
    resetForm,
    toggleHasVariations,
    handleDeleteProductGroup,
  };
}

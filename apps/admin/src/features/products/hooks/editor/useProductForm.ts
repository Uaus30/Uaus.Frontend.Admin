import { RESOURCE_KEYS } from "@/hooks/use-catalog";
import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@workspace/ui";
import { getEnumOptions } from "@/services/core";

import { deleteProductGroup } from "@/services/products.service";
import { createEmptyProductEditor } from "./utils";
import type { ProductGroupForm, ProductEditorForm, LocalImage } from "../../types";
import type { TagDto } from "@workspace/api-client-react";
import {
  useAllDepartments,
  useAllCategories,
  useAllTags,
  useAllProductTags,
  useAllProductGroups,
  CATALOG_KEYS,
} from "@/hooks/use-catalog";
import { describeApiError } from "@workspace/core";

export interface UseProductFormProps {
  form: ProductGroupForm;
  setForm: React.Dispatch<React.SetStateAction<ProductGroupForm>>;
  productEditor: ProductEditorForm;
  setProductEditor: React.Dispatch<React.SetStateAction<ProductEditorForm>>;
  setEditingGroupId: React.Dispatch<React.SetStateAction<number | null>>;
  setLoadedGroupId: React.Dispatch<React.SetStateAction<number | null>>;
  setActiveVariationKey: React.Dispatch<React.SetStateAction<string | null>>;
  setVariationDrafts: React.Dispatch<React.SetStateAction<any[]>>;
  setImages: React.Dispatch<React.SetStateAction<LocalImage[]>>;
}

export function useProductForm({
  form,
  setForm,
  productEditor,
  setProductEditor,
  setEditingGroupId,
  setLoadedGroupId,
  setActiveVariationKey,
  setVariationDrafts,
  setImages,
}: UseProductFormProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: departments = [] } = useAllDepartments();

  const { data: categories = [] } = useAllCategories();

  const { data: productGroups = [] } = useAllProductGroups();

  const { data: tags = [] } = useAllTags();

  const { data: productTags = [] } = useAllProductTags();

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
    const byId = statusOptions.find((opt) => String(opt.id) === statusStr);
    if (byId) return String(byId.id);
    const byValue = statusOptions.find((opt) => opt.value.toLowerCase() === statusStr.toLowerCase());
    if (byValue) return String(byValue.id);
    const byName = statusOptions.find((opt) => opt.name.toLowerCase() === statusStr.toLowerCase());
    if (byName) return String(byName.id);
    return statusStr;
  };

  const getStatusNumber = (statusVal: any): number => {
    if (statusVal === undefined || statusVal === null) return 0;
    const statusStr = String(statusVal);
    const option = statusOptions.find(
      (opt) =>
        String(opt.id) === statusStr ||
        opt.value.toLowerCase() === statusStr.toLowerCase() ||
        opt.name.toLowerCase() === statusStr.toLowerCase(),
    );
    return option ? option.id : Number(statusVal);
  };

  const defaultStatus = useMemo(() => {
    const activeOpt = statusOptions.find(
      (opt) => opt.name.toLowerCase() === "ativo" || opt.value.toLowerCase() === "ativo",
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
    // Invalida o RECURSO inteiro: a listagem da feature de etiquetas, o catálogo
    // e a busca do autocomplete desta mesma tela ficam sob o mesmo prefixo.
    queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.tags });
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

  function toggleHasVariations(checked: boolean) {
    setForm((current) => ({ ...current, hasVariations: checked }));
    setVariationDrafts([]);
    setActiveVariationKey(null);
  }

  async function handleDeleteProductGroup(productGroupId: number) {
    try {
      await deleteProductGroup(productGroupId);
      await Promise.all([
        // `RESOURCE_KEYS.products` é o que tira a linha excluída da TABELA: desde
        // o item 4.1 ela é uma query só, sob `["products","table", params]`.
        queryClient.invalidateQueries({ queryKey: RESOURCE_KEYS.products }),
        queryClient.invalidateQueries({ queryKey: CATALOG_KEYS.productGroups }),
        queryClient.invalidateQueries({ queryKey: ["products-page"] }),
        queryClient.invalidateQueries({ queryKey: ["products-by-group", productGroupId] }),
        queryClient.invalidateQueries({ queryKey: ["product-group-history", productGroupId] }),
      ]);
      toast({ title: "Produto removido com sucesso." });
    } catch (error) {
      toast({
        title: "Erro ao remover produto",
        description: describeApiError(error, "Tente novamente."),
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
    productGroups,
    registerTag,
    resetForm,
    toggleHasVariations,
    handleDeleteProductGroup,
  };
}

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { deleteProduct } from "@/services/products.service";
import { createVariationDraft } from "./utils";
import type { VariationDraft, Grade, ProductGroupForm, ProductEditorForm } from "../../types";

export interface UseProductVariationsProps {
  form: ProductGroupForm;
  setForm: React.Dispatch<React.SetStateAction<ProductGroupForm>>;
  productEditor: ProductEditorForm;
  variationDrafts: VariationDraft[];
  setVariationDrafts: React.Dispatch<React.SetStateAction<VariationDraft[]>>;
  activeVariationKey: string | null;
  setActiveVariationKey: React.Dispatch<React.SetStateAction<string | null>>;
  gradesList: Grade[];
  setActiveGrades: React.Dispatch<React.SetStateAction<Grade[]>>;
  defaultStatus: string;
  editingGroupId: number | null;
  invalidateProductQueries: (groupId?: number | null) => Promise<void>;
  refetchGroupProducts: () => Promise<any>;
}

export function useProductVariations({
  form,
  setForm,
  productEditor,
  variationDrafts,
  setVariationDrafts,
  activeVariationKey,
  setActiveVariationKey,
  gradesList,
  setActiveGrades,
  defaultStatus,
  editingGroupId,
  invalidateProductQueries,
  refetchGroupProducts,
}: UseProductVariationsProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const activeVariation = useMemo(
    () => variationDrafts.find((variation) => variation.key === activeVariationKey) ?? null,
    [activeVariationKey, variationDrafts],
  );

  function updateVariationDraft(
    key: string,
    updater: (draft: VariationDraft) => VariationDraft,
  ) {
    setVariationDrafts((current) =>
      current.map((draft) => (draft.key === key ? updater(draft) : draft)),
    );
  }

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
      });
    }
  }

  return {
    activeVariation,
    updateVariationDraft,
    generateVariationsMatrix,
    addVariationDraft,
    handleDeleteVariation,
  };
}

import { useMemo } from "react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { deleteProduct } from "@/services/products.service";
import { createVariationDraft } from "./utils";
import { gerarCombinacoes } from "../../lib/variationMatrix";
import type { VariationDraft, ProductGrade, ProductGroupForm, ProductEditorForm } from "../../types";

export interface UseProductVariationsProps {
  form: ProductGroupForm;
  setForm: React.Dispatch<React.SetStateAction<ProductGroupForm>>;
  productEditor: ProductEditorForm;
  variationDrafts: VariationDraft[];
  setVariationDrafts: React.Dispatch<React.SetStateAction<VariationDraft[]>>;
  activeVariationKey: string | null;
  setActiveVariationKey: React.Dispatch<React.SetStateAction<string | null>>;
  defaultStatus: string;
  editingGroupId: number | null;
  invalidateProductQueries: (groupId?: number | null) => Promise<void>;
  refetchGroupProducts: () => Promise<unknown>;
}

export function useProductVariations({
  form,
  setForm,
  productEditor,
  variationDrafts,
  setVariationDrafts,
  activeVariationKey,
  setActiveVariationKey,
  defaultStatus,
  editingGroupId,
  invalidateProductQueries,
  refetchGroupProducts,
}: UseProductVariationsProps) {
  const { toast } = useToast();

  const activeVariation = useMemo(
    () => variationDrafts.find((variation) => variation.key === activeVariationKey) ?? null,
    [activeVariationKey, variationDrafts],
  );

  function updateVariationDraft(key: string, updater: (draft: VariationDraft) => VariationDraft) {
    setVariationDrafts((current) => current.map((draft) => (draft.key === key ? updater(draft) : draft)));
  }

  /**
   * Cria uma variação por combinação das grades escolhidas.
   *
   * Preço, estoque mínimo e código de barras saem do produto principal como
   * ponto de partida — é o que o operador acabou de digitar, e repetir o mesmo
   * número em seis linhas à mão não ajuda ninguém. O NOME não vem daqui: ele é
   * sempre o do grupo, e o que distingue as linhas é a combinação de grades.
   */
  function generateVariationsMatrix(grades: ProductGrade[]) {
    const combinacoes = gerarCombinacoes(grades);
    if (combinacoes.length === 0) {
      setVariationDrafts([]);
      setForm((current) => ({ ...current, hasVariations: false }));
      setActiveVariationKey(null);
      return;
    }

    const novos = combinacoes.map((values) => {
      const draft = createVariationDraft(defaultStatus, form.productGroupName.trim());
      draft.price = productEditor.price;
      draft.stock = 0;
      draft.minStock = productEditor.minStock;
      draft.barcode = "";
      draft.values = values;
      return draft;
    });

    setVariationDrafts(novos);
    setForm((current) => ({ ...current, hasVariations: true }));
    setActiveVariationKey(novos[0].key);
  }

  /**
   * Acrescenta uma variação avulsa, fora da matriz.
   *
   * Existe para o caso de o operador precisar de uma combinação a mais sem
   * regerar tudo (regerar apaga preço e código digitados linha a linha). Os
   * valores de grade vêm vazios e ele preenche na própria tabela.
   */
  function addVariationDraft(initialValues?: Partial<VariationDraft>) {
    const draft = createVariationDraft(defaultStatus, form.productGroupName.trim());
    draft.price = initialValues?.price ?? productEditor.price;
    draft.minStock = initialValues?.minStock ?? productEditor.minStock;
    draft.barcode = initialValues?.barcode ?? "";
    draft.stock = initialValues?.stock ?? 0;
    draft.values = initialValues?.values ?? [];
    if (initialValues?.status) draft.status = initialValues.status;

    setVariationDrafts((current) => [...current, draft]);
    setForm((f) => ({ ...f, hasVariations: true }));
    setActiveVariationKey(draft.key);
  }

  async function handleDeleteVariation(draft: VariationDraft) {
    if (draft.id == null || draft.id === 0) {
      const nextDrafts = variationDrafts.filter((item) => item.key !== draft.key);
      setVariationDrafts(nextDrafts);
      setForm((f) => ({ ...f, hasVariations: nextDrafts.length > 0 }));
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
      setForm((f) => ({ ...f, hasVariations: nextDrafts.length > 0 }));
      if (activeVariationKey === draft.key) {
        setActiveVariationKey(nextDrafts[0]?.key ?? null);
      }

      toast({ title: "Variação removida." });
    } catch (error) {
      toast({
        title: "Erro ao remover variação",
        description: describeApiError(error, "Tente novamente."),
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

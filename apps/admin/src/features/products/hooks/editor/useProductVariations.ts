import { useMemo } from "react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { deleteProduct } from "@/services/products.service";
import { createVariationDraft } from "./utils";
import { gerarCombinacoes, mesclarMatriz } from "../../lib/variationMatrix";
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
   * Gera/regenera a matriz MESCLANDO com o que o produto já tem.
   *
   * Combinação que continua na matriz preserva o draft atual — id, preço,
   * código de barras, imagens. Combinação nova nasce com preço e estoque mínimo
   * do produto principal como ponto de partida. Combinação que saiu é excluída
   * do servidor na hora (como o lixo da linha faz), exceto as que têm venda
   * (`canDelete === false`), que permanecem na lista com um aviso.
   *
   * Antes a regeração descartava TUDO: drafts novos sem id viravam produtos
   * NOVOS no salvar e os antigos ficavam no banco — o grupo acumulava
   * duplicatas até a checagem de combinação repetida travar o cadastro.
   */
  async function generateVariationsMatrix(grades: ProductGrade[]) {
    const combinacoes = gerarCombinacoes(grades);
    if (combinacoes.length === 0) {
      setVariationDrafts([]);
      setForm((current) => ({ ...current, hasVariations: false }));
      setActiveVariationKey(null);
      return;
    }

    const { slots, removidas } = mesclarMatriz(variationDrafts, combinacoes);

    const bloqueadas: VariationDraft[] = [];
    let excluidas = 0;
    for (const draft of removidas) {
      if (draft.id == null || draft.id === 0) continue;

      if (draft.canDelete === false) {
        bloqueadas.push(draft);
        continue;
      }

      try {
        await deleteProduct(draft.id);
        excluidas += 1;
      } catch (error) {
        // Exclusão recusada (ex.: ganhou venda entre o carregar e o agora):
        // a variação fica na lista, senão ela some da tela mas continua no banco.
        bloqueadas.push(draft);
        toast({
          title: "Variação não pôde ser excluída",
          description: describeApiError(error, "Ela continua na lista."),
          variant: "destructive",
        });
      }
    }

    const finais = slots.map(({ values, existente }) => {
      if (existente) return existente;
      const draft = createVariationDraft(defaultStatus, form.productGroupName.trim());
      draft.price = productEditor.price;
      draft.stock = 0;
      draft.minStock = productEditor.minStock;
      draft.barcode = "";
      draft.values = values;
      return draft;
    });

    // As bloqueadas entram no fim: continuam existindo e o operador decide.
    const proximos = [...finais, ...bloqueadas];
    setVariationDrafts(proximos);
    setForm((current) => ({ ...current, hasVariations: true }));
    setActiveVariationKey(proximos[0].key);

    if (excluidas > 0) {
      await invalidateProductQueries(editingGroupId);
      toast({ title: `${excluidas} variação(ões) fora da matriz foram excluídas.` });
    }
    if (bloqueadas.length > 0) {
      toast({
        title: "Variações com movimento foram mantidas",
        description: `${bloqueadas.length} variação(ões) fora da matriz têm venda ou estoque e não podem ser excluídas.`,
        variant: "warning",
      });
    }
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

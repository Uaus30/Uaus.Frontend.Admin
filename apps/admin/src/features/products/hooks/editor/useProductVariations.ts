import { useMemo } from "react";
import { useToast } from "@workspace/ui";
import { describeApiError } from "@workspace/core";
import { deleteProduct } from "@/services/products.service";
import { createVariationDraft } from "./utils";
import { aplicarGradesNasLinhas, gradesDasVariacoes, trocarTipoDeGrade } from "../../lib/variationGrades";
import type { GradeTypeCode } from "@workspace/api-client-react";
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
   * Aplica no cadastro as grades escolhidas na modal — só as COLUNAS.
   *
   * Marcar "Cor" põe a coluna em branco em todas as linhas da tabela; desmarcar
   * apaga a coluna e os valores dela. Nenhuma linha é criada nem excluída aqui,
   * fora a PRIMEIRA (ver `primeiraVariacaoDoProduto`): linha nova sai do
   * "Acrescentar variação" e o único caminho de exclusão é o lixo da linha, que
   * pede confirmação.
   *
   * A modal cruzava as grades e gerava a matriz cartesiana até 12/09/2026, no
   * cadastro que ainda não tinha variação salva. Dois motivos derrubaram o
   * cruzamento:
   *
   * 1. **Ele nunca chegou à tela em produto já gravado.** Um produto simples
   *    salvo tem a tabela VAZIA (ele mora no `productEditor`, não nos drafts),
   *    então a modal pedia os valores, gerava a matriz — e a carga do grupo
   *    pelo servidor a sobrescrevia logo depois, deixando uma linha só e sem
   *    coluna nenhuma. É o relato do produto 897, em produção.
   * 2. **Duas modais para o mesmo botão.** Qual delas aparecia dependia de o
   *    produto já ter variação gravada, coisa que ninguém vê na tela.
   *
   * A validação do salvamento cobra valor em toda grade do grupo, então a
   * coluna nova sai vermelha até ser preenchida: é o "preenchimento manual
   * obrigatório" desenhado de propósito, não um efeito colateral.
   */
  function applyGrades(grades: ProductGrade[]) {
    const tipos: GradeTypeCode[] = grades.map((grade) => grade.type);
    const linhas = variationDrafts.length > 0 ? variationDrafts : [primeiraVariacaoDoProduto()];
    const proximos = aplicarGradesNasLinhas(linhas, tipos);

    setVariationDrafts(proximos);
    setForm((atual) => ({ ...atual, hasVariations: true }));
    setActiveVariationKey((atual) => atual ?? proximos[0]?.key ?? null);
  }

  /**
   * A primeira linha da tabela: o PRÓPRIO produto que está na tela.
   *
   * Um produto que ganha variações não vira um cadastro novo — ele vira a
   * primeira variação de si mesmo. Por isso a linha carrega o `id`: no salvar,
   * o `saveProductGroupWithProducts` ATUALIZA esse produto (código de barras,
   * preço, estoque, etiquetas e histórico ficam onde estão) em vez de criar um
   * irmão e deixar o original como variação sem grade nenhuma no mesmo grupo.
   *
   * Em cadastro que ainda não foi salvo o `id` é nulo e a linha nasce com o que
   * já estiver preenchido na aba Dados — o salvar cria o produto.
   */
  function primeiraVariacaoDoProduto(): VariationDraft {
    const draft = createVariationDraft(defaultStatus, form.productGroupName.trim());

    return {
      ...draft,
      ...productEditor,
      // A chave espelha a das variações vindas do servidor (`toVariationDraft`),
      // senão a mesma linha teria duas identidades entre um salvar e outro.
      key: productEditor.id ? `product-${productEditor.id}` : draft.key,
      // O nome gravado é o do GRUPO em toda variação; o que distingue uma da
      // outra são os valores de grade.
      name: form.productGroupName.trim(),
      status: productEditor.status || defaultStatus,
      values: [],
    };
  }

  /**
   * Troca o tipo de uma coluna de grade em todas as variações.
   *
   * A importação do sistema anterior trouxe muito produto com a grade "Modelo"
   * onde o valor é cor ou tamanho. Corrigir pela modal de configuração não
   * resolve: as combinações de "Cor" não têm grade em comum com as de "Modelo",
   * então a matriz nasceria em branco e as variações com código de barras
   * iriam para a exclusão. Aqui a variação continua a mesma — muda o nome da
   * coluna, e o cadastro só é gravado no salvar, como qualquer edição da tabela.
   */
  function changeGradeType(de: GradeTypeCode, para: GradeTypeCode) {
    setVariationDrafts((current) => trocarTipoDeGrade(current, de, para));
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
    // Nasce com as COLUNAS que a tabela já mostra, em branco: sem isso a linha
    // nova ficaria sem as grades do grupo, a validação não cobraria nada dela e
    // ela seria gravada como variação sem valor de grade.
    draft.values =
      initialValues?.values ??
      gradesDasVariacoes(variationDrafts).map((grade) => ({ gradeType: grade.type, value: "" }));
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
        error,
        variant: "destructive",
      });
    }
  }

  return {
    activeVariation,
    updateVariationDraft,
    applyGrades,
    changeGradeType,
    addVariationDraft,
    handleDeleteVariation,
  };
}

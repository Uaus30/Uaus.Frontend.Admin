import { GRADE_TYPE } from "@workspace/api-client-react";
import { MAX_SALE_PRICE, exceedsMaxSalePrice, formatCurrency, isBelowCost } from "@workspace/core";
import type { ProductEditorForm, ProductGroupForm, VariationDraft } from "../types";
import { gradesDasVariacoes } from "./variationGrades";

/** O que a validação devolve para a tela pintar de vermelho e focar. */
export type ProductFormValidation = {
  /** Chave do campo -> está inválido. As chaves de variação são `<campo>-<key>`. */
  errors: Record<string, boolean>;
  /** `id` do primeiro elemento inválido, na ordem em que aparecem na tela. */
  firstErrorElementId: string | null;
};

type ValidateProductFormParams = {
  form: ProductGroupForm;
  productEditor: ProductEditorForm;
  variationDrafts: VariationDraft[];
};

/**
 * Valida o cadastro antes de gravar.
 *
 * É validação de PREENCHIMENTO, não de regra de negócio: quem recusa preço
 * negativo ou categoria de outro departamento é o backend. O que ela evita é a
 * ida ao servidor para voltar com "campo obrigatório" — e, principalmente, o
 * erro genérico do 400 no lugar da borda vermelha no campo que falta.
 *
 * Todos os campos cobertos aqui moram na aba **Dados**. Quem chama precisa
 * trazer essa aba para a frente antes de focar o elemento: focar um campo que
 * está dentro de aba fechada não faz nada, e o operador vê o salvar falhar sem
 * nada acontecer na tela.
 *
 * O nome da variação NÃO é validado: ele é derivado (grupo + grades) e a coluna
 * é somente leitura — marcar um campo que não existe na tela fazia o salvar
 * "não responder" quando o draft nascia com o nome vazio.
 */
export function validateProductForm({
  form,
  productEditor,
  variationDrafts,
}: ValidateProductFormParams): ProductFormValidation {
  const errors: Record<string, boolean> = {};
  let firstErrorElementId: string | null = null;

  const marcar = (chave: string, elementId: string) => {
    errors[chave] = true;
    if (!firstErrorElementId) firstErrorElementId = elementId;
  };

  if (!form.productGroupName.trim()) marcar("name", "input-name");
  if (!form.departmentId) marcar("department", "select-department");
  if (!form.categoryId) marcar("category", "select-category");

  if (!form.hasVariations) {
    if (!productEditor.price || productEditor.price <= 0) marcar("price", "input-price");
    if (!productEditor.status) marcar("status", "select-status");
  } else {
    // As grades do GRUPO são as que aparecem em alguma variação: cada linha
    // precisa ter valor em todas elas, senão duas variações saem com o mesmo
    // nome composto. A chave `grade-<tipo>-<key>` é a que a tabela já pinta.
    const gradesDoGrupo = gradesDasVariacoes(variationDrafts);

    variationDrafts.forEach((draft) => {
      for (const grade of gradesDoGrupo) {
        // A MARCA pode ficar em branco (22/10/2026, decisão do dono): é como nasce
        // a variação do código novo quando o antigo já tinha vendas.
        if (grade.type === GRADE_TYPE.Brand) continue;
        const valor = (draft.values ?? []).find((value) => value.gradeType === grade.type)?.value?.trim();
        if (!valor) marcar(`grade-${grade.type}-${draft.key}`, `input-grade-${grade.type}-${draft.key}`);
      }
      if (!draft.price || draft.price <= 0) marcar(`price-${draft.key}`, `input-price-${draft.key}`);
      if (!draft.status) marcar(`status-${draft.key}`, `select-status-${draft.key}`);
    });
  }

  return { errors, firstErrorElementId };
}

/**
 * Preço acima do teto da loja (R$ 30, 22/10/2026): as chaves dos campos para a
 * tela pintar e a mensagem do aviso, ou `null` quando está tudo dentro. O backend
 * recusa do mesmo jeito; aqui o aviso aponta o campo antes da ida à rede.
 */
export function salePriceLimitProblem({
  form,
  productEditor,
  variationDrafts,
}: ValidateProductFormParams): { errors: Record<string, boolean>; message: string } | null {
  const errors: Record<string, boolean> = {};
  if (!form.hasVariations) {
    if (exceedsMaxSalePrice(productEditor.price)) errors.price = true;
  } else {
    for (const draft of variationDrafts)
      if (exceedsMaxSalePrice(draft.price)) errors[`price-${draft.key}`] = true;
  }
  if (Object.keys(errors).length === 0) return null;
  return {
    errors,
    message: `O preço de venda não pode passar de ${formatCurrency(MAX_SALE_PRICE)}, o teto da loja.`,
  };
}

/**
 * O que vai ser gravado com preço ABAIXO do custo — margem negativa (22/10/2026).
 *
 * A loja permite (o custo pode passar do teto de R$ 30), mas a tela pergunta
 * antes. O custo do produto simples vem de fora (o "Último custo" da aba, ou o
 * da compra no cadastro que veio dela); o de cada variação gravada vem do
 * rascunho. Variação nova não tem custo, e não entra.
 */
export function belowCostItems({
  form,
  productEditor,
  variationDrafts,
  simpleCost,
}: ValidateProductFormParams & { simpleCost: number | null }): string[] {
  if (!form.hasVariations)
    return simpleCost !== null && isBelowCost(simpleCost, productEditor.price)
      ? [form.productGroupName || productEditor.name]
      : [];

  return variationDrafts
    .filter((draft) => draft.costPrice !== undefined && isBelowCost(draft.costPrice, draft.price))
    .map((draft) => {
      const valores = draft.values.map((value) => value.value.trim()).filter(Boolean);
      return valores.length > 0 ? `${form.productGroupName} [${valores.join(", ")}]` : form.productGroupName;
    });
}

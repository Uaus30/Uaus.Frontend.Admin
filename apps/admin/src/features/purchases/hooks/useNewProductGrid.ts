import { emptyNewRow, nextNewBrandKey } from "../lib/new-brand";
import { recomputeGrid, sumItems } from "../lib/purchase-items";
import type { PurchaseForm } from "../types";

type UseNewProductGridParams = {
  setForm: React.Dispatch<React.SetStateAction<PurchaseForm>>;
  /** O operador mexeu na grade: avisa quem guarda o "há algo para perder". */
  onEdit: () => void;
};

/**
 * Produto NOVO comprado já com variações (fase 5 do plano de grupo × variação,
 * 14/10/2026; desenho aprovado pelo dono em 21/10/2026).
 *
 * Até aqui comprar com variação exigia o produto cadastrado — foi a parte cara
 * cortada em 12/09/2026. Agora a compra de produto ainda não cadastrado escolhe
 * UM tipo de grade, e o campo de quantidade vira a grade de sempre, só que com
 * linhas SEM cadastro, uma por valor ("P", "M", "G"). São as linhas da marca
 * nova da fase 4 — mesma chave negativa, mesmo código opcional, mesmo
 * recebimento que exige o código bipado ou gerado —, e por isso o resto
 * (quantidade, custo, rateio, acrescentar e tirar linha) é o `usePurchaseVariations`.
 * O produto, com as variações, nasce no recebimento.
 */
export function useNewProductGrid({ setForm, onEdit }: UseNewProductGridParams) {
  /**
   * Escolher o tipo troca o campo de quantidade por uma grade de duas linhas — a
   * primeira com a quantidade do campo, porque produto com uma variação só não
   * existe. Trocar de um tipo para outro mantém as linhas (só o rótulo muda), e
   * "Sem variações" volta ao campo com a soma — em custo manual, os totais
   * também viram a soma do que estava na grade.
   */
  function setNewProductGradeType(tipo: number | null) {
    onEdit();
    setForm((atual) => {
      if (tipo === null) {
        if (atual.newVariationGradeType === null) return atual;
        const totais = atual.costSplitManual
          ? {
              grossTotal: sumItems(atual.items, "grossTotal"),
              finalTotal: sumItems(atual.items, "finalTotal"),
            }
          : {};
        return {
          ...atual,
          ...totais,
          newVariationGradeType: null,
          items: [],
          quantity: Math.max(sumItems(atual.items, "quantity"), 1),
          costSplitManual: false,
        };
      }
      if (atual.newVariationGradeType !== null) return { ...atual, newVariationGradeType: tipo };

      const primeira = emptyNewRow(nextNewBrandKey([]), Math.max(atual.quantity, 1));
      const segunda = emptyNewRow(nextNewBrandKey([primeira]), 1);
      // O código passa a ser de cada variação: o do cabeçalho sai.
      return recomputeGrid({
        ...atual,
        newVariationGradeType: tipo,
        productBarcode: null,
        items: [primeira, segunda],
      });
    });
  }

  return { setNewProductGradeType };
}

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { subscribeToReactivations } from "@/lib/product-reactivation";
import type { ProductEditorForm, VariationDraft } from "../../types";
import { withReactivatedStatus, withReactivatedStatuses } from "../../lib/reactivatedStatus";

/**
 * Mantém o status do formulário em dia quando uma entrada de estoque reativa a
 * variação aberta (23/09/2026) — pela aba Estoque ou pela contagem física, as
 * duas lançadas de dentro desta tela.
 *
 * Usa os setters CRUS: o servidor já está assim, e a troca não pode sujar a
 * tela nem pedir "descartar alterações?" ao fechar. A regra está em
 * `withReactivatedStatus`.
 */
export function useReactivatedStatusSync(
  setProductEditor: Dispatch<SetStateAction<ProductEditorForm>>,
  setVariationDrafts: Dispatch<SetStateAction<VariationDraft[]>>,
) {
  useEffect(
    () =>
      subscribeToReactivations((products) => {
        setProductEditor((current) => withReactivatedStatus(current, products));
        setVariationDrafts((current) => withReactivatedStatuses(current, products));
      }),
    [setProductEditor, setVariationDrafts],
  );
}

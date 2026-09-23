import { useState } from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_STATUS } from "@workspace/api-client-react";
import { announceReactivatedProducts, dismissReactivatedProducts } from "@/lib/product-reactivation";
import type { ProductEditorForm, VariationDraft } from "../../../types";
import { createEmptyProductEditor } from "../utils";
import { useReactivatedStatusSync } from "../useReactivatedStatusSync";

const SEM_ESTOQUE = String(PRODUCT_STATUS.OutOfStock);
const ATIVO = String(PRODUCT_STATUS.Active);

function variacao(id: number): VariationDraft {
  return {
    ...createEmptyProductEditor(SEM_ESTOQUE),
    id,
    key: `product-${id}`,
    images: [],
    canDelete: false,
    values: [],
  };
}

/** O editor aberto: o produto simples e as variações, como o `useProductEditor` os guarda. */
function useEditorAberto(simples: ProductEditorForm, variacoes: VariationDraft[]) {
  const [productEditor, setProductEditor] = useState(simples);
  const [variationDrafts, setVariationDrafts] = useState(variacoes);
  useReactivatedStatusSync(setProductEditor, setVariationDrafts);
  return { productEditor, variationDrafts };
}

describe("useReactivatedStatusSync", () => {
  beforeEach(() => dismissReactivatedProducts());

  it("a entrada que reativa a variação aberta põe o formulário em Ativo", () => {
    // Sem isto, o Salvar seguinte gravaria "Sem estoque" por cima da reativação.
    const { result } = renderHook(() =>
      useEditorAberto({ ...createEmptyProductEditor(SEM_ESTOQUE), id: 30 }, [variacao(10), variacao(11)]),
    );

    act(() =>
      announceReactivatedProducts([
        { productId: 30, productName: "BACIA 1L", previousStatus: "OutOfStock" },
        { productId: 10, productName: "BALDE [PRETO]", previousStatus: "OutOfStock" },
      ]),
    );

    expect(result.current.productEditor.status).toBe(ATIVO);
    expect(result.current.variationDrafts.map((draft) => draft.status)).toEqual([ATIVO, SEM_ESTOQUE]);
  });

  it("para de escutar quando a tela desmonta", () => {
    // Setters espiões: depois do unmount o `result` não muda mais de qualquer
    // jeito, então só a chamada ao setter prova que a escuta continuou viva.
    const setProductEditor = vi.fn();
    const setVariationDrafts = vi.fn();
    const { unmount } = renderHook(() => useReactivatedStatusSync(setProductEditor, setVariationDrafts));
    unmount();

    act(() =>
      announceReactivatedProducts([{ productId: 30, productName: "BACIA 1L", previousStatus: "OutOfStock" }]),
    );

    expect(setProductEditor).not.toHaveBeenCalled();
    expect(setVariationDrafts).not.toHaveBeenCalled();
  });
});

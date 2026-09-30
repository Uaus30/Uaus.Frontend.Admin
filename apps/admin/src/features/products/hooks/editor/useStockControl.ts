import type React from "react";
import { useGetCompanySettings } from "@workspace/api-client-react";
import { STANDARD_DEFAULT_MIN_STOCK } from "@/lib/stock-control";
import type { ProductEditorForm, ProductGroupForm, VariationDraft } from "../../types";
import {
  viewStockControl,
  type StockControlChoice,
  type StockControlView,
} from "../../lib/stockControlChoice";

export interface UseStockControlProps {
  form: ProductGroupForm;
  setForm: React.Dispatch<React.SetStateAction<ProductGroupForm>>;
  productEditor: ProductEditorForm;
  variationDrafts: VariationDraft[];
  markDirty: () => void;
}

export interface StockControlState {
  /** O interruptor como a tela deve mostrar: ligado, desligado ou misto. */
  view: StockControlView;
  /** Mexe no interruptor (ou no motivo). Vale para todas as variações. */
  choose: (choice: StockControlChoice) => void;
  /** Estoque mínimo padrão da loja — o que vale quando o produto não tem mínimo próprio. */
  defaultMinStock: number;
  /** Classificação da rotina diária do produto simples; ausente em grupo com variações. */
  forecastStatus: ProductEditorForm["forecastStatus"];
  monthlySalesMedian: ProductEditorForm["monthlySalesMedian"];
}

/**
 * O interruptor "Controlar estoque" da aba Opcionais (29/09/2026).
 *
 * Todo produto nasce controlado; desligar é decisão de quem cadastra. Num grupo
 * com variações o interruptor vale para TODAS — e, quando o relatório de
 * estoque baixo desligou só algumas, ele mostra o estado misto em vez de
 * fingir um dos dois. O salvar só manda o controle se a pessoa mexeu aqui.
 *
 * O mínimo padrão vem das Configurações, para o campo "Estoque mínimo" dizer
 * qual número vale quando fica vazio.
 */
export function useStockControl({
  form,
  setForm,
  productEditor,
  variationDrafts,
  markDirty,
}: UseStockControlProps): StockControlState {
  const { data: settings } = useGetCompanySettings();

  const produtos = form.hasVariations ? variationDrafts : [productEditor];

  return {
    view: viewStockControl(form.stockControl, produtos),
    choose: (choice) => {
      markDirty();
      setForm((current) => ({ ...current, stockControl: choice }));
    },
    defaultMinStock: settings?.defaultMinStock ?? STANDARD_DEFAULT_MIN_STOCK,
    forecastStatus: form.hasVariations ? null : productEditor.forecastStatus,
    monthlySalesMedian: form.hasVariations ? null : productEditor.monthlySalesMedian,
  };
}

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@workspace/ui";
import { ProductBasicInfo } from "../editor/ProductBasicInfo";
import { ProductPricing } from "../editor/ProductPricing";
import { ProductCostAndStock } from "../editor/ProductCostAndStock";
import { ProductImageGallery } from "../editor/ProductImageGallery";
import { ProductOptionalFields } from "../editor/ProductOptionalFields";
import { ProductVariationsManager } from "../editor/ProductVariationsManager";
import type { useProductEditor } from "../../hooks/useProductEditor";
import type { BarcodeInputResolution } from "@workspace/core";
import type { VariationDraft } from "../../types";

type ProductGeneralTabProps = {
  editor: ReturnType<typeof useProductEditor>;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  barcodeInput: BarcodeInputResolution;
  currentBarcode: string;
  flashSuccess: boolean;
  setSearchModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setVariationToDelete: React.Dispatch<React.SetStateAction<VariationDraft | null>>;
  /** Abre a escolha de grades e valores da variação. */
  onOpenGradePicker: () => void;
};

/**
 * Aba **Dados**: os campos sem os quais o produto não salva (nome,
 * departamento, categoria, preço e status), as fotos e, atrás de "Mais campos",
 * os opcionais.
 *
 * **As fotos ficam à direita, no lugar da prévia do código de barras**
 * (04/10/2026): a capa grande e duas menores (`ProductImagesSection`). No
 * celular elas descem para depois dos campos.
 *
 * **"Mais campos" substituiu a aba Opcionais** (04/10/2026, pedido do dono): o
 * estoque mínimo e o controle de estoque, que são o ajuste mais frequente de lá,
 * exigiam trocar de aba. Os campos continuam ocultos por padrão — o cadastro do
 * dia a dia não os preenche —, e abrir não vai ao servidor nem perde o que foi
 * digitado: fechar só esconde.
 */
export function ProductGeneralTab({
  editor,
  validationErrors,
  setValidationErrors,
  barcodeInput,
  currentBarcode,
  flashSuccess,
  setSearchModalOpen,
  setVariationToDelete,
  onOpenGradePicker,
}: ProductGeneralTabProps) {
  const { form, variationDrafts } = editor;
  const [maisCampos, setMaisCampos] = useState(false);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border/50 bg-background/40 p-5">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ProductBasicInfo
                editor={editor}
                validationErrors={validationErrors}
                setValidationErrors={setValidationErrors}
                barcodeInput={barcodeInput}
                currentBarcode={currentBarcode}
                flashSuccess={flashSuccess}
              />

              {/* Só leitura, acima de preço e status: é com eles na vista que se decide o preço. */}
              <ProductCostAndStock editor={editor} />

              <ProductPricing
                editor={editor}
                validationErrors={validationErrors}
                setValidationErrors={setValidationErrors}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => setMaisCampos((aberto) => !aberto)}
              aria-expanded={maisCampos}
              aria-controls="product-optional-fields"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${maisCampos ? "rotate-180" : ""}`} />
              {maisCampos ? "Menos campos" : "Mais campos"}
              <span className="text-xs font-normal">
                (descrição, tags, estoque mínimo, controle de estoque, site e observações)
              </span>
            </Button>

            {/* Escondido com `hidden`, e não desmontado: o que foi digitado lá
                dentro continua no formulário, e o salvar o leva junto. */}
            <div id="product-optional-fields" hidden={!maisCampos} className="border-t border-border/40 pt-4">
              <ProductOptionalFields editor={editor} />
            </div>
          </div>

          <ProductImageGallery editor={editor} setSearchModalOpen={setSearchModalOpen} />
        </div>
      </div>

      <ProductVariationsManager
        editor={editor}
        validationErrors={validationErrors}
        setVariationToDelete={setVariationToDelete}
      />

      {/*
        O botão continua disponível DEPOIS de gerar a matriz: acrescentar ou
        tirar uma grade é operação normal, e a modal reabre marcada com o que o
        produto já tem. Em produto JÁ CADASTRADO ela só acrescenta e remove
        COLUNA — nenhuma variação é criada nem excluída, e o valor de cada linha
        é digitado na tabela. Trocar o TIPO da grade é no título da coluna.
      */}
      <Button
        type="button"
        className="bg-orange-500 hover:bg-orange-600 text-white"
        onClick={onOpenGradePicker}
      >
        {form.hasVariations || variationDrafts.length > 0 ? "Configurar Variações" : "Cadastrar Variações"}
      </Button>
    </div>
  );
}

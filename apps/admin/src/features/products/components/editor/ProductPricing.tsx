import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { CurrencyInput } from "../CurrencyInput";
import type { useProductEditor } from "../../hooks/useProductEditor";

type ProductPricingProps = {
  editor: ReturnType<typeof useProductEditor>;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
};

/**
 * Preço de venda e status do produto SIMPLES.
 *
 * Some quando o grupo tem variações: aí quem tem preço e status é cada variação,
 * na tabela de variações. Um preço no grupo, nesse caso, seria campo que não vai
 * para lugar nenhum — e o operador o preencheria achando que vale para todas.
 *
 * Estoque mínimo, estoque atual e visibilidade moravam aqui atrás do botão de
 * olho; foram para a aba **Opcionais** da tela de detalhe.
 */
export function ProductPricing({ editor, validationErrors, setValidationErrors }: ProductPricingProps) {
  const { form, productEditor, setProductEditor, selectableStatusOptions } = editor;

  if (form.hasVariations) return null;

  return (
    <>
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Preço de venda (R$) <span className="text-red-500">*</span>
        </label>
        <CurrencyInput
          id="input-price"
          value={productEditor.price}
          onChange={(val) => {
            setProductEditor((current) => ({ ...current, price: val }));
            if (validationErrors.price) setValidationErrors((prev) => ({ ...prev, price: false }));
          }}
          className={`bg-background w-full ${validationErrors.price ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500" : ""}`}
        />
        {validationErrors.price && (
          <p className="text-xs text-red-500 font-medium">Preenchimento obrigatório</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Status <span className="text-red-500">*</span>
        </label>
        <Select
          value={productEditor.status}
          onValueChange={(value) => {
            setProductEditor((current) => ({ ...current, status: value }));
            if (validationErrors.status) setValidationErrors((prev) => ({ ...prev, status: false }));
          }}
        >
          <SelectTrigger
            id="select-status"
            className={`bg-background w-full ${validationErrors.status ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500" : ""}`}
          >
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {selectableStatusOptions.map((status) => (
              <SelectItem key={status.id} value={status.id.toString()}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {validationErrors.status && (
          <p className="text-xs text-red-500 font-medium">Preenchimento obrigatório</p>
        )}
      </div>
    </>
  );
}

import React from "react";
import { Input } from "@workspace/ui";
import { Switch } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui";
import { HelpCircle } from "lucide-react";
import { CurrencyInput } from "../CurrencyInput";
import type { useProductEditor } from "../../hooks/useProductEditor";

type ProductPricingAndStockProps = {
  editor: ReturnType<typeof useProductEditor>;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  showOptionalFields: boolean;
};

export function ProductPricingAndStock({
  editor,
  validationErrors,
  setValidationErrors,
  showOptionalFields,
}: ProductPricingAndStockProps) {
  const { form, setForm, productEditor, setProductEditor, selectableStatusOptions } = editor;

  return (
    <>
      {!form.hasVariations && (
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
      )}

      {showOptionalFields && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:col-span-2">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <label className="text-sm font-medium">Estoque mínimo</label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger type="button" tabIndex={-1}>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Defina um valor maior que zero para controlar o estoque deste produto.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              type="number"
              min="0"
              value={productEditor.minStock}
              onChange={(event) =>
                setProductEditor((current) => ({ ...current, minStock: Number(event.target.value) }))
              }
              className="bg-background"
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <label className="text-sm font-medium">Estoque atual</label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger type="button" tabIndex={-1}>
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Calculado automaticamente com base nas entradas de estoque.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Input
              type="number"
              value={productEditor.stock}
              readOnly
              className="bg-muted/30 text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Visibilidade</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer border border-border/50 rounded-md px-3 h-10 bg-card hover:bg-muted/50 transition-colors w-full justify-between">
              <span className="font-medium shrink-0">Exibir no site</span>
              <Switch
                checked={form.isPublic}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, isPublic: checked === true }))
                }
              />
            </label>
          </div>
        </div>
      )}
    </>
  );
}

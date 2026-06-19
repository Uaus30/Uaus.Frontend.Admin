import React from "react";
import { Loader2, Printer, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "./CurrencyInput";
import type { VariationDraft, Grade } from "../types";

type ProductVariationsSectionProps = {
  /** Array of currently configured variation drafts */
  variationDrafts: VariationDraft[];
  /** Grades active for the product's category (e.g. Size, Color) */
  activeGrades: Grade[];
  /** Boolean indicating if loading existing products under the group */
  isFetchingGroupProducts: boolean;
  /** Selectable list of status configurations from API/enums */
  selectableStatusOptions: any[];
  /** Validation errors map to highlight invalid fields in red */
  validationErrors: Record<string, boolean>;
  /** Callback to update a variation's properties */
  updateVariationDraft: (key: string, updater: (draft: VariationDraft) => VariationDraft) => void;
  /** Callback handler to execute barcode label printing */
  handlePrintBarcode: (barcodeValue: string, name?: string, price?: number) => void;
  /** Handler to set the variation to be confirmed for deletion in AlertDialog */
  setVariationToDelete: (variation: VariationDraft) => void;
  /** Handler to delete a variation locally or on the API */
  handleDeleteVariation: (variation: VariationDraft) => void;
  /** Callback to append a new blank/pre-filled variation draft row */
  addVariationDraft: (initialValues?: Partial<VariationDraft>) => void;
};

/**
 * ProductVariationsSection
 * 
 * Renders the variations table when hasVariations is enabled.
 * Features:
 * - Table header with headers matching selected category grades.
 * - Dynamic rows displaying:
 *   - Barcode text input (or Auto placeholder) + Print Label shortcut.
 *   - SKU/Variation name input with validation feedback.
 *   - Dropdown selectors matching variant values for each active grade.
 *   - Inline Price input formatted as currency.
 *   - SKU Status selector.
 *   - Delete button (disabled if backend does not permit removal).
 * - "Ghost Row" at the bottom to quickly append new variation drafts by entering a name or barcode.
 */
export function ProductVariationsSection({
  variationDrafts,
  activeGrades,
  isFetchingGroupProducts,
  selectableStatusOptions,
  validationErrors,
  updateVariationDraft,
  handlePrintBarcode,
  setVariationToDelete,
  handleDeleteVariation,
  addVariationDraft,
}: ProductVariationsSectionProps) {
  if (variationDrafts.length === 0) return null;

  return (
    <div
      id="variations-table-container"
      className="space-y-4 rounded-2xl border border-border/50 bg-background/40 p-5 mt-6 animate-in fade-in slide-in-from-bottom-4 transition-all duration-300"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">VARIAÇÕES DO PRODUTO</h2>
        {isFetchingGroupProducts ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground border-b border-border/50">
            <tr>
              <th className="px-4 py-3 font-medium w-48 text-center">CÓDIGO</th>
              <th className="px-4 pl-7 py-3 font-medium">Nome</th>
              {activeGrades.map((g) => (
                <th
                  key={g.id}
                  className="px-3 py-3 font-medium w-32 border-l border-border/30 bg-muted/20 text-foreground"
                >
                  {g.name}
                </th>
              ))}
              <th className="px-4 py-3 font-medium w-32 text-center">
                PREÇO <span className="text-red-500">*</span>
              </th>
              <th className="px-4 py-3 font-medium w-32 text-center">
                Status <span className="text-red-500">*</span>
              </th>
              <th className="px-4 py-3 font-medium text-right w-16">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {variationDrafts.map((variation) => (
              <tr key={variation.key} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-2 text-center">
                  <div className="flex items-center gap-1 justify-center">
                    <Input
                      value={variation.barcode || ""}
                      onChange={(e) =>
                        updateVariationDraft(variation.key, (draft) => ({
                          ...draft,
                          barcode: e.target.value,
                        }))
                      }
                      placeholder="Auto"
                      className="h-8 bg-transparent border-transparent hover:border-border focus:bg-background font-mono text-xs text-center"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                      onClick={() =>
                        handlePrintBarcode(variation.barcode || "", variation.name, variation.price)
                      }
                      disabled={!(variation.barcode && variation.barcode.trim().length > 0)}
                      title="Imprimir etiqueta"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
                <td className="px-4 py-2">
                  <Input
                    id={`input-name-${variation.key}`}
                    value={variation.name}
                    onChange={(e) => {
                      updateVariationDraft(variation.key, (draft) => ({
                        ...draft,
                        name: e.target.value,
                      }));
                    }}
                    className={`h-8 bg-transparent border-transparent hover:border-border focus:bg-background uppercase ${
                      validationErrors[`name-${variation.key}`]
                        ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500"
                        : ""
                    }`}
                  />
                  {validationErrors[`name-${variation.key}`] && (
                    <p className="text-[10px] text-red-500 font-medium leading-tight mt-0.5">
                      Preenchimento obrigatório
                    </p>
                  )}
                </td>
                {activeGrades.map((g) => {
                  const variantId = variation.variantMap?.[g.id];
                  return (
                    <td key={g.id} className="px-2 py-2 border-l border-border/30 bg-muted/5">
                      <Select
                        value={variantId?.toString() || ""}
                        onValueChange={(val) => {
                          const newVariantMap = {
                            ...(variation.variantMap || {}),
                            [g.id]: Number(val),
                          };
                          updateVariationDraft(variation.key, (draft) => ({
                            ...draft,
                            variantMap: newVariantMap,
                          }));
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs bg-transparent border-transparent hover:border-border">
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent>
                          {g.variants.map((v) => (
                            <SelectItem key={v.id} value={v.id.toString()}>
                              {v.value}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  );
                })}
                <td className="px-4 py-2 text-center">
                  <CurrencyInput
                    id={`input-price-${variation.key}`}
                    value={variation.price}
                    onChange={(val) => {
                      updateVariationDraft(variation.key, (draft) => ({
                        ...draft,
                        price: val,
                      }));
                    }}
                    className={`h-8 bg-transparent border-transparent hover:border-border focus:bg-background cursor-pointer focus:cursor-text text-center ${
                      validationErrors[`price-${variation.key}`]
                        ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500"
                        : ""
                    }`}
                  />
                  {validationErrors[`price-${variation.key}`] && (
                    <p className="text-[10px] text-red-500 font-medium leading-tight mt-0.5">
                      Preenchimento obrigatório
                    </p>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  <Select
                    value={variation.status}
                    onValueChange={(value) => {
                      updateVariationDraft(variation.key, (draft) => ({
                        ...draft,
                        status: value,
                      }));
                    }}
                  >
                    <SelectTrigger
                      id={`select-status-${variation.key}`}
                      className={`h-8 bg-transparent border-transparent hover:border-border focus:bg-background justify-center text-center ${
                        validationErrors[`status-${variation.key}`]
                          ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500"
                          : ""
                      }`}
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
                  {validationErrors[`status-${variation.key}`] && (
                    <p className="text-[10px] text-red-500 font-medium leading-tight mt-0.5">
                      Preenchimento obrigatório
                    </p>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={variation.id != null && variation.canDelete === false}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (variation.id != null) {
                        setVariationToDelete(variation);
                      } else {
                        handleDeleteVariation(variation);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}

            {/* Ghost Row */}
            <tr className="hover:bg-muted/10 transition-colors border-t border-dashed border-primary/20 bg-primary/5 group">
              <td className="px-4 py-2 text-center">
                <Input
                  placeholder="0000000000000"
                  className="h-8 bg-transparent border-transparent group-hover:border-primary/30 focus:bg-background font-mono text-xs focus:border-primary text-center"
                  onBlur={(e) => {
                    if (e.target.value.trim()) {
                      addVariationDraft({ barcode: e.target.value.trim() });
                      e.target.value = "";
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </td>
              <td className="px-4 py-2">
                <Input
                  placeholder="ADICIONAR VARIAÇÃO..."
                  className="h-8 bg-transparent border-transparent group-hover:border-primary/30 focus:bg-background uppercase focus:border-primary text-xs"
                  onBlur={(e) => {
                    if (e.target.value.trim()) {
                      addVariationDraft({ name: e.target.value.trim().toUpperCase() });
                      e.target.value = "";
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      e.currentTarget.blur();
                    }
                  }}
                />
              </td>
              <td colSpan={2 + activeGrades.length} className="px-4 py-2"></td>
              <td className="px-4 py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

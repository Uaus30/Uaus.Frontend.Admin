import React from "react";
import { Input } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui";
import { HelpCircle, Plus, Printer } from "lucide-react";
import Barcode from "react-barcode";
import { TagMultiSelect } from "@/components/tag-multi-select";
import type { useProductEditor } from "../../hooks/useProductEditor";

type ProductBasicInfoProps = {
  editor: ReturnType<typeof useProductEditor>;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  showOptionalFields: boolean;
  displayBarcode: string;
  currentBarcode: string;
  flashSuccess: boolean;
  handlePrintBarcode: (barcodeValue: string, customName?: string, customPrice?: number) => void;
};

export function ProductBasicInfo({
  editor,
  validationErrors,
  setValidationErrors,
  showOptionalFields,
  displayBarcode,
  currentBarcode,
  flashSuccess,
  handlePrintBarcode,
}: ProductBasicInfoProps) {
  const {
    form,
    setForm,
    productEditor,
    setProductEditor,
    departments,
    filteredCategories,
    tags,
    registerTag,
  } = editor;

  return (
    <>
      <div className="space-y-2 sm:col-span-2">
        <div className="flex items-center gap-1">
          <label className="text-sm font-medium">Código de barras</label>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger type="button" tabIndex={-1}>
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Deixe vazio para geração automática do código de barras caso deseje.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-4">
          <Input
            value={productEditor.barcode || ""}
            onChange={(event) => setProductEditor((current) => ({ ...current, barcode: event.target.value }))}
            className={`bg-background flex-1 font-mono transition-all duration-300 ${flashSuccess ? "animate-border-flash" : ""}`}
            placeholder="Ex: 7891234567890"
          />
          <div
            className={`flex items-center bg-white px-2 py-1 rounded border transition-all duration-300 ${currentBarcode.length === 0 ? "opacity-40 grayscale" : "opacity-100"}`}
          >
            <Barcode
              value={displayBarcode}
              format={displayBarcode.length === 8 ? "EAN8" : "EAN13"}
              height={30}
              width={1.5}
              fontSize={12}
              margin={0}
              background="transparent"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => handlePrintBarcode(displayBarcode)}
            title="Imprimir etiqueta (80mm)"
            disabled={currentBarcode.length === 0}
          >
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 sm:col-span-2">
        <label className="text-sm font-medium">
          Nome <span className="text-red-500">*</span>
        </label>
        <Input
          id="input-name"
          value={form.productGroupName}
          onChange={(event) => {
            const value = event.target.value.toUpperCase();
            setForm((current) => ({ ...current, productGroupName: value }));
            setProductEditor((current) => ({ ...current, name: value }));
            if (validationErrors.name) setValidationErrors((prev) => ({ ...prev, name: false }));
          }}
          className={`bg-background uppercase ${validationErrors.name ? "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500" : ""}`}
          placeholder="EX: COPO TÉRMICO 500ML"
        />
        {validationErrors.name && (
          <p className="text-xs text-red-500 font-medium">Preenchimento obrigatório</p>
        )}
      </div>

      {showOptionalFields && (
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">Descrição</label>
          <Input
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            className="bg-background"
          />
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Departamento <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <Select
            value={form.departmentId}
            onValueChange={(value) => {
              setForm((current) => ({ ...current, departmentId: value, categoryId: "" }));
              if (validationErrors.department)
                setValidationErrors((prev) => ({ ...prev, department: false }));
            }}
          >
            <SelectTrigger
              id="select-department"
              className={`bg-background flex-1 ${validationErrors.department ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500" : ""}`}
            >
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id.toString()}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => window.open("/departamentos", "_blank")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {validationErrors.department && (
          <p className="text-xs text-red-500 font-medium">Preenchimento obrigatório</p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">
          Categoria <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <Select
            value={form.categoryId}
            onValueChange={(value) => {
              setForm((current) => ({ ...current, categoryId: value }));
              if (validationErrors.category) setValidationErrors((prev) => ({ ...prev, category: false }));
            }}
          >
            <SelectTrigger
              id="select-category"
              className={`bg-background flex-1 ${validationErrors.category ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500" : ""}`}
            >
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((category) => (
                <SelectItem key={category.id} value={category.id.toString()}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => window.open("/categorias", "_blank")}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {validationErrors.category && (
          <p className="text-xs text-red-500 font-medium">Preenchimento obrigatório</p>
        )}
      </div>

      {showOptionalFields && (
        <div className="space-y-2 sm:col-span-2">
          <label className="text-sm font-medium">Tags</label>
          <TagMultiSelect
            allTags={tags}
            selectedIds={productEditor.tagIds}
            onChange={(tagIds) => setProductEditor((current) => ({ ...current, tagIds }))}
            onTagCreated={registerTag}
            placeholder="Selecione ou crie uma nova tag"
          />
        </div>
      )}
    </>
  );
}

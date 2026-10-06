import React from "react";
import { Input, uppercaseKeepingCaret } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@workspace/ui";
import { HelpCircle, Plus } from "lucide-react";
import type { BarcodeInputResolution } from "@workspace/core";
import type { useProductEditor } from "../../hooks/useProductEditor";

type ProductBasicInfoProps = {
  editor: ReturnType<typeof useProductEditor>;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  /** O que a API vai gravar a partir do campo — ou a razão da recusa. */
  barcodeInput: BarcodeInputResolution;
  currentBarcode: string;
  flashSuccess: boolean;
};

/**
 * Campos obrigatórios de identificação: código de barras, nome, departamento e
 * categoria.
 *
 * Descrição e etiquetas moram em "Mais campos", abaixo de preço e status. O que
 * fica aqui é o que impede o cadastro de ser salvo — e é por isso que abre a
 * tela.
 *
 * **Sem prévia do código de barras e sem o botão de imprimir** (04/10/2026,
 * pedido do dono: "se mostrou inútil na prática"). A etiqueta se imprime na tela
 * Etiquetas, que continua como estava; no lugar da prévia ficaram as fotos do
 * produto. Os avisos de código inválido, interno e gerado continuam embaixo do
 * campo — é o campo que grava.
 */
export function ProductBasicInfo({
  editor,
  validationErrors,
  setValidationErrors,
  barcodeInput,
  currentBarcode,
  flashSuccess,
}: ProductBasicInfoProps) {
  const { form, setForm, productEditor, setProductEditor, departments, filteredCategories, lookupBarcode } =
    editor;

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
              <TooltipContent className="max-w-xs">
                <p>
                  Informe os 13 dígitos impressos na embalagem, até 11 dígitos para gerar um código interno
                  com esse número dentro, ou deixe vazio para a loja gerar um código.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center">
          <Input
            value={productEditor.barcode || ""}
            onChange={(event) => {
              const value = event.target.value;
              setProductEditor((current) => ({ ...current, barcode: value }));
              // Código já cadastrado troca o assunto da tela: em vez de deixar
              // a pessoa terminar um cadastro que o backend vai recusar, carrega
              // o produto que já existe. Só vale para cadastro novo.
              lookupBarcode(value);
            }}
            inputMode="numeric"
            aria-invalid={barcodeInput.kind === "invalid"}
            className={`bg-background flex-1 font-mono transition-all duration-300 ${flashSuccess ? "animate-border-flash" : ""} ${
              barcodeInput.kind === "invalid"
                ? "border-red-500 ring-1 ring-red-500 focus-visible:ring-red-500"
                : ""
            }`}
            placeholder="Ex: 7891234567890"
          />
        </div>
        {barcodeInput.error && <p className="text-xs font-medium text-red-500">{barcodeInput.error}</p>}
        {barcodeInput.kind === "internal" && (
          // Dizer o número que será gravado evita a surpresa de salvar "20" e
          // encontrar "2000000000206" no cadastro depois.
          <p className="text-muted-foreground text-xs">
            Será gravado como <span className="font-mono">{barcodeInput.code}</span>, da faixa interna da
            loja.
          </p>
        )}
        {barcodeInput.kind === "generated" &&
          currentBarcode.length === 0 &&
          (productEditor.id ? (
            // Produto JÁ GRAVADO com o campo apagado: salvar assim descarta o
            // código atual e emite outro da sequence, e toda etiqueta colada
            // naquela mercadoria para de achar o produto. O aviso existe porque
            // o texto de cadastro novo, logo abaixo, convidava a isso sem dizer
            // que havia um código para perder.
            <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
              Atenção: este produto já tem código. Salvando com o campo vazio, a loja gera um código NOVO e as
              etiquetas já impressas deixam de encontrá-lo.
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">Sem código informado, a loja gera um ao salvar.</p>
          ))}
      </div>

      <div className="space-y-2 sm:col-span-2">
        <label className="text-sm font-medium">
          Nome <span className="text-red-500">*</span>
        </label>
        <Input
          id="input-name"
          value={form.productGroupName}
          onChange={(event) => {
            // Sem perder o cursor: digitar no meio do nome o jogava para o fim.
            const value = uppercaseKeepingCaret(event.target);
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
          {/*
            Nova aba, aqui e no "+" da categoria: na mesma janela, o cadastro
            aberto se perderia. Vale também no app do iPhone, onde a nova aba
            abre no Safari e pede login uma vez (decisão do dono, 05/10/2026).
          */}
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
    </>
  );
}

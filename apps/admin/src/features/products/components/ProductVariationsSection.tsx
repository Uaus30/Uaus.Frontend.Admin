import React from "react";
import { Loader2, Printer, Trash2 } from "lucide-react";
import { Input } from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui";
import { CurrencyInput } from "./CurrencyInput";
import { VariationGradeHeader } from "./VariationGradeHeader";
import { nomeExibidoDaVariacao } from "../lib/variationMatrix";
import type { VariationDraft, ProductGrade } from "../types";

type ProductVariationsSectionProps = {
  /** Array of currently configured variation drafts */
  variationDrafts: VariationDraft[];
  /** Grades escolhidas para ESTE produto, com os valores de cada uma */
  selectedGrades: ProductGrade[];
  /** Nome do grupo — é ele que abre o nome exibido de toda variação */
  productGroupName: string;
  /** Boolean indicating if loading existing products under the group */
  isFetchingGroupProducts: boolean;
  /** Selectable list of status configurations from API/enums */
  selectableStatusOptions: Array<{ id: number; name: string }>;
  /** Validation errors map to highlight invalid fields in red */
  validationErrors: Record<string, boolean>;
  /** Callback to update a variation's properties */
  updateVariationDraft: (key: string, updater: (draft: VariationDraft) => VariationDraft) => void;
  /** Callback handler to execute barcode label printing */
  handlePrintBarcode: (barcode: string, name?: string, price?: number) => void;
  /** Handler to set the variation to be confirmed for deletion in AlertDialog */
  setVariationToDelete: (variation: VariationDraft) => void;
  /** Handler to delete a variation locally or on the API */
  handleDeleteVariation: (variation: VariationDraft) => void;
  /** Acrescenta uma linha fora da matriz, para o operador preencher a grade à mão */
  addVariationDraft: (initialValues?: Partial<VariationDraft>) => void;
  /** Troca o TIPO de uma coluna de grade em todas as variações de uma vez */
  changeGradeType: (de: ProductGrade["type"], para: ProductGrade["type"]) => void;
};

/**
 * Tabela das variações do produto.
 *
 * O NOME não é editável, e essa é a mudança de 30/08/2026: toda variação leva o
 * nome do grupo, e o que a distingue são os valores de grade. A coluna "Variação"
 * mostra o nome composto — o mesmo que a venda, o cupom e a etiqueta vão exibir —
 * e as colunas de grade mostram o valor de cada uma.
 *
 * Antes o operador digitava "CAMISETA AZUL G" à mão em cada linha, e o sistema
 * não tinha como saber que aquilo era azul nem tamanho G: 159 dos 162 produtos
 * com variação acabaram com a grade escrita dentro do nome, sem estrutura
 * nenhuma por trás.
 */
export function ProductVariationsSection({
  variationDrafts,
  selectedGrades,
  productGroupName,
  isFetchingGroupProducts,
  selectableStatusOptions,
  validationErrors,
  updateVariationDraft,
  handlePrintBarcode,
  setVariationToDelete,
  handleDeleteVariation,
  addVariationDraft,
  changeGradeType,
}: ProductVariationsSectionProps) {
  if (variationDrafts.length === 0) return null;

  /** O valor que esta variação tem para uma grade, ou vazio. */
  const valorDaGrade = (variation: VariationDraft, type: ProductGrade["type"]) =>
    variation.values.find((value) => value.gradeType === type)?.value ?? "";

  /** Grava o valor da grade na linha, criando ou trocando o que existir. */
  const definirValor = (variation: VariationDraft, type: ProductGrade["type"], valor: string) => {
    updateVariationDraft(variation.key, (draft) => {
      const outros = draft.values.filter((value) => value.gradeType !== type);
      const proximos = valor.trim() ? [...outros, { gradeType: type, value: valor }] : outros;
      return { ...draft, values: proximos };
    });
  };

  return (
    <div
      id="variations-table-container"
      className="space-y-4 rounded-2xl border border-border/50 bg-background/40 p-5 mt-6 animate-in fade-in slide-in-from-bottom-4 transition-all duration-300"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          VARIAÇÕES DO PRODUTO
        </h2>
        {isFetchingGroupProducts ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/50 bg-card/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/30 text-xs uppercase text-muted-foreground border-b border-border/50">
            <tr>
              <th className="px-4 py-3 font-medium w-48 text-center">CÓDIGO</th>
              {selectedGrades.map((grade) => (
                <th
                  key={grade.type}
                  className="px-2 py-2 font-medium w-32 border-l border-border/30 bg-muted/20 text-foreground"
                >
                  <div className="flex items-center gap-1">
                    <VariationGradeHeader
                      type={grade.type}
                      tiposEmUso={selectedGrades.map((outra) => outra.type)}
                      onChangeType={changeGradeType}
                    />
                    <span className="text-red-500">*</span>
                  </div>
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Variação</th>
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
                        handlePrintBarcode(
                          variation.barcode || "",
                          nomeExibidoDaVariacao(productGroupName, variation.values),
                          variation.price,
                        )
                      }
                      disabled={!(variation.barcode && variation.barcode.trim().length > 0)}
                      title="Imprimir etiqueta"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>

                {selectedGrades.map((grade) => (
                  <td key={grade.type} className="px-2 py-2 border-l border-border/30 bg-muted/5">
                    <Input
                      id={`input-grade-${grade.type}-${variation.key}`}
                      value={valorDaGrade(variation, grade.type)}
                      onChange={(e) => definirValor(variation, grade.type, e.target.value)}
                      placeholder="-"
                      className={`h-8 text-xs bg-transparent border-transparent hover:border-border focus:bg-background uppercase ${
                        validationErrors[`grade-${grade.type}-${variation.key}`]
                          ? "border-red-500 ring-1 ring-red-500 focus:ring-red-500"
                          : ""
                      }`}
                    />
                  </td>
                ))}

                {/*
                  Somente leitura de propósito: o nome é derivado do grupo mais os
                  valores de grade. Editável, ele voltaria a divergir da estrutura
                  — que é exatamente o problema que esta tela veio resolver.
                */}
                <td className="px-4 py-2">
                  <span className="block truncate text-xs font-medium text-foreground">
                    {nomeExibidoDaVariacao(productGroupName, variation.values)}
                  </span>
                </td>

                <td className="px-4 py-2 text-center">
                  <CurrencyInput
                    id={`input-price-${variation.key}`}
                    value={variation.price}
                    onChange={(val) =>
                      updateVariationDraft(variation.key, (draft) => ({ ...draft, price: val }))
                    }
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
                    onValueChange={(value) =>
                      updateVariationDraft(variation.key, (draft) => ({ ...draft, status: value }))
                    }
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
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          O nome da variação é montado a partir do nome do produto e dos valores de grade. O título de cada
          coluna troca o tipo da grade. Para acrescentar valores ou uma grade nova, use{" "}
          <strong>Configurar Variações</strong>.
        </p>
        {/*
          Acrescentar uma linha avulsa evita regerar a matriz só para incluir uma
          combinação — regerar apaga preço e código digitados linha a linha.
        */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => addVariationDraft()}
        >
          Acrescentar variação
        </Button>
      </div>
    </div>
  );
}

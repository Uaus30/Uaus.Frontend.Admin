import React from "react";
import { GRADE_TYPE_LABELS } from "@workspace/api-client-react";
import { VariationGradeHeader } from "./VariationGradeHeader";
import {
  VariationBarcodeField,
  VariationDeleteButton,
  VariationGradeField,
  VariationPriceField,
  VariationStatusField,
  VariationStock,
} from "./VariationFields";
import { nomeExibidoDaVariacao } from "../lib/variationNames";
import type { ProductGrade, VariationDraft } from "../types";

type ProductVariationCardsProps = {
  variationDrafts: VariationDraft[];
  selectedGrades: ProductGrade[];
  productGroupName: string;
  selectableStatusOptions: Array<{ id: number; name: string }>;
  validationErrors: Record<string, boolean>;
  updateVariationDraft: (key: string, updater: (draft: VariationDraft) => VariationDraft) => void;
  setVariationToDelete: (variation: VariationDraft) => void;
  handleDeleteVariation: (variation: VariationDraft) => void;
  changeGradeType: (de: ProductGrade["type"], para: ProductGrade["type"]) => void;
  /** O valor que a variação tem para uma grade (vazio quando não tem). */
  gradeValue: (variation: VariationDraft, type: ProductGrade["type"]) => string;
  /** Grava o valor da grade na variação — a regra mora na seção. */
  setGradeValue: (variation: VariationDraft, type: ProductGrade["type"], value: string) => void;
};

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  const className = "mb-1 block text-[11px] font-medium uppercase text-muted-foreground";
  return htmlFor ? (
    <label htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ) : (
    <span className={className}>{children}</span>
  );
}

function Required() {
  return <span className="text-red-500"> *</span>;
}

/**
 * As variações em cartões, no lugar da tabela, abaixo do `lg` (06/10/2026).
 *
 * A tabela pedia ~900px de largura mínima — três telas de rolagem lateral num
 * celular, sem coluna fixa: ao chegar no preço já não se sabia de qual variação
 * era a linha. No cartão o NOME vem em cima, ocupando a largura toda, e os
 * campos embaixo, com rótulo: o dono corrige variação pelo celular (preço,
 * status, código).
 *
 * A troca do TIPO da grade, que na tabela mora no título da coluna, fica num
 * seletor só acima dos cartões — a grade é do grupo, não da variação.
 */
export function ProductVariationCards({
  variationDrafts,
  selectedGrades,
  productGroupName,
  selectableStatusOptions,
  validationErrors,
  updateVariationDraft,
  setVariationToDelete,
  handleDeleteVariation,
  changeGradeType,
  gradeValue,
  setGradeValue,
}: ProductVariationCardsProps) {
  const tiposEmUso = selectedGrades.map((grade) => grade.type);

  return (
    <div className="space-y-3">
      {selectedGrades.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-card/80 px-3 py-2">
          <span className="text-xs text-muted-foreground">Tipo das grades:</span>
          {selectedGrades.map((grade) => (
            <div key={grade.type} className="min-w-[7rem] rounded-md border border-border/50">
              <VariationGradeHeader
                type={grade.type}
                tiposEmUso={tiposEmUso}
                onChangeType={changeGradeType}
              />
            </div>
          ))}
        </div>
      )}

      <ul className="space-y-3">
        {variationDrafts.map((variation) => (
          <li
            key={variation.key}
            data-testid={`variation-card-${variation.key}`}
            className="space-y-3 rounded-xl border border-border/50 bg-card/80 p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 break-words pt-2 text-sm font-medium text-foreground">
                {nomeExibidoDaVariacao(productGroupName, variation.values)}
              </p>
              <VariationDeleteButton
                variation={variation}
                setVariationToDelete={setVariationToDelete}
                handleDeleteVariation={handleDeleteVariation}
                className="-mr-1 h-10 w-10 shrink-0"
              />
            </div>

            {selectedGrades.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {selectedGrades.map((grade) => (
                  <div key={grade.type} className="min-w-0">
                    <FieldLabel htmlFor={`input-grade-${grade.type}-${variation.key}`}>
                      {GRADE_TYPE_LABELS[grade.type]}
                      <Required />
                    </FieldLabel>
                    <VariationGradeField
                      compact={false}
                      variation={variation}
                      grade={grade.type}
                      value={gradeValue(variation, grade.type)}
                      onChange={(value) => setGradeValue(variation, grade.type, value)}
                      invalid={!!validationErrors[`grade-${grade.type}-${variation.key}`]}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <FieldLabel htmlFor={`input-price-${variation.key}`}>
                  Preço
                  <Required />
                </FieldLabel>
                <VariationPriceField
                  compact={false}
                  variation={variation}
                  updateVariationDraft={updateVariationDraft}
                  invalid={!!validationErrors[`price-${variation.key}`]}
                />
              </div>
              <div className="min-w-0">
                <FieldLabel htmlFor={`select-status-${variation.key}`}>
                  Status
                  <Required />
                </FieldLabel>
                <VariationStatusField
                  compact={false}
                  variation={variation}
                  updateVariationDraft={updateVariationDraft}
                  options={selectableStatusOptions}
                  invalid={!!validationErrors[`status-${variation.key}`]}
                />
              </div>
              <div className="min-w-0">
                <FieldLabel>Código</FieldLabel>
                <VariationBarcodeField
                  compact={false}
                  variation={variation}
                  updateVariationDraft={updateVariationDraft}
                />
              </div>
              <div className="min-w-0">
                <FieldLabel>Estoque</FieldLabel>
                <div className="flex h-10 items-center text-sm">
                  <VariationStock variation={variation} />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

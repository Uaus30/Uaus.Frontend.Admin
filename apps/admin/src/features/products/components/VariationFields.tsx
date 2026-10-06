import React from "react";
import { Trash2 } from "lucide-react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@workspace/ui";
import { formatQuantity, resolveBarcodeInput } from "@workspace/core";
import { CurrencyInput } from "./CurrencyInput";
import type { ProductGrade, VariationDraft } from "../types";

/**
 * Os campos de UMA variação, compartilhados pela tabela (computador) e pelos
 * cartões (celular) de `ProductVariationsSection`.
 *
 * Moram aqui para as duas formas nunca divergirem na regra — o código de barras
 * resolvido pela mesma função do produto simples, o valor vazio da grade, a
 * linha não salva sem estoque. Só a APARÊNCIA muda com `compact`: na tabela o
 * campo é transparente até o hover, para a linha ler como texto; no cartão ele
 * tem borda, porque no toque não existe hover e o campo transparente parecia
 * texto que não se edita.
 *
 * Os `id`s (`input-price-*`, `select-status-*`, `input-grade-*`) são os que a
 * validação procura para focar o campo com erro — por isso só UMA das duas
 * formas é renderizada de cada vez.
 */
type FieldLook = { compact: boolean };

const COMPACT = "h-8 bg-transparent border-transparent hover:border-border focus:bg-background";
const ROOMY = "h-10 bg-background";
const INVALID = "border-red-500 ring-1 ring-red-500 focus:ring-red-500";

function look(compact: boolean) {
  return compact ? COMPACT : ROOMY;
}

function RequiredMessage() {
  return (
    <p className="mt-0.5 text-[10px] font-medium leading-tight text-red-500">Preenchimento obrigatório</p>
  );
}

type UpdateDraft = (key: string, updater: (draft: VariationDraft) => VariationDraft) => void;

export function VariationBarcodeField({
  variation,
  updateVariationDraft,
  compact,
}: FieldLook & { variation: VariationDraft; updateVariationDraft: UpdateDraft }) {
  // A MESMA regra do campo do produto simples. Sem ela, a linha da grade
  // imprimia o rascunho digitado (`0020`) enquanto a API gravava
  // `2000000000206` — etiqueta colada na mercadoria que o PDV não acha ao bipar,
  // que é justamente o defeito que a padronização de 21/09/2026 veio fechar.
  const barcodeInput = resolveBarcodeInput(variation.barcode || "");
  const invalid = barcodeInput.kind === "invalid";

  return (
    <>
      <Input
        value={variation.barcode || ""}
        onChange={(e) =>
          updateVariationDraft(variation.key, (draft) => ({ ...draft, barcode: e.target.value }))
        }
        placeholder="Auto"
        inputMode="numeric"
        aria-invalid={invalid}
        aria-label="Código de barras"
        title={barcodeInput.error ?? undefined}
        className={cn(
          look(compact),
          "font-mono text-xs",
          compact && "text-center",
          invalid && "border-red-500 text-red-600",
        )}
      />
      {/* No cartão (celular) o motivo vai por extenso: no toque não há `title`
          para ler. Na tabela ele ficaria com seis linhas numa célula estreita —
          lá vai o aviso curto, e o motivo no `title` do campo, no hover. */}
      {invalid && (
        <p className="mt-1 text-[10px] font-medium text-red-500">
          {compact ? "Código inválido — passe o mouse no campo para ver o motivo." : barcodeInput.error}
        </p>
      )}
    </>
  );
}

export function VariationGradeField({
  variation,
  grade,
  value,
  onChange,
  invalid,
  compact,
}: FieldLook & {
  variation: VariationDraft;
  grade: ProductGrade["type"];
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  return (
    <Input
      id={`input-grade-${grade}-${variation.key}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="-"
      className={cn(look(compact), "text-xs uppercase", invalid && INVALID)}
    />
  );
}

export function VariationPriceField({
  variation,
  updateVariationDraft,
  invalid,
  compact,
}: FieldLook & { variation: VariationDraft; updateVariationDraft: UpdateDraft; invalid: boolean }) {
  return (
    <>
      <CurrencyInput
        id={`input-price-${variation.key}`}
        value={variation.price}
        onChange={(val) => updateVariationDraft(variation.key, (draft) => ({ ...draft, price: val }))}
        className={cn(
          look(compact),
          compact && "cursor-pointer text-center focus:cursor-text",
          invalid && INVALID,
        )}
      />
      {invalid && <RequiredMessage />}
    </>
  );
}

export function VariationStatusField({
  variation,
  updateVariationDraft,
  options,
  invalid,
  compact,
}: FieldLook & {
  variation: VariationDraft;
  updateVariationDraft: UpdateDraft;
  options: Array<{ id: number; name: string }>;
  invalid: boolean;
}) {
  return (
    <>
      <Select
        value={variation.status}
        onValueChange={(value) =>
          updateVariationDraft(variation.key, (draft) => ({ ...draft, status: value }))
        }
      >
        <SelectTrigger
          id={`select-status-${variation.key}`}
          className={cn(look(compact), compact && "justify-center text-center", invalid && INVALID)}
        >
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((status) => (
            <SelectItem key={status.id} value={status.id.toString()}>
              {status.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {invalid && <RequiredMessage />}
    </>
  );
}

/**
 * Linha ainda não salva mostra travessão, não "0 un": ela não existe no banco,
 * então não tem saldo — zero ali seria um dado inventado. O estoque entra pela
 * aba Estoque, depois de salvar.
 */
export function VariationStock({ variation }: { variation: VariationDraft }) {
  return variation.id ? (
    <span className="font-medium text-foreground">{formatQuantity(variation.stock ?? 0)} un</span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
}

export function VariationDeleteButton({
  variation,
  setVariationToDelete,
  handleDeleteVariation,
  className,
}: {
  variation: VariationDraft;
  setVariationToDelete: (variation: VariationDraft) => void;
  handleDeleteVariation: (variation: VariationDraft) => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Excluir variação"
      disabled={variation.id != null && variation.canDelete === false}
      className={cn("h-8 w-8 text-muted-foreground hover:text-destructive", className)}
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
  );
}

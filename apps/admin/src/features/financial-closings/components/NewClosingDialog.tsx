import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@workspace/ui";
import { Button } from "@workspace/ui";
import { Label } from "@workspace/ui";
import { Textarea } from "@workspace/ui";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { ClosingSummary } from "./ClosingSummary";
import { CompetencePicker } from "./CompetencePicker";
import type {
  FinancialClosingPreviewDto,
  FinancialClosingVariableCostDto,
  MonthOption,
  NewClosingStep,
} from "../types";

interface NewClosingDialogProps {
  open: boolean;
  step: NewClosingStep;
  /** Ano da competência. */
  year: number;
  /** Mês da competência (1–12) ou `null` enquanto ninguém escolheu. */
  month: number | null;
  yearOptions: number[];
  monthOptions: MonthOption[];
  isLoadingMonths: boolean;
  notes: string;
  preview: FinancialClosingPreviewDto | null;
  isCalculating: boolean;
  isSaving: boolean;
  onClose: () => void;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onApplyLastMonth: () => void;
  onCalculatePreview: () => void;
  onAddVariableCost: (cost: FinancialClosingVariableCostDto) => void;
  onRemoveVariableCost: (index: number) => void;
  onBackToCompetence: () => void;
  onNotesChange: (notes: string) => void;
  onConfirm: () => void;
}

/**
 * NewClosingDialog
 *
 * Diálogo de novo fechamento em dois passos: escolha da competência — mês e ano,
 * com atalho "Último mês" — → prévia calculada no servidor + observações +
 * confirmação. A prévia não persiste nada; ao confirmar, o servidor recalcula e
 * congela.
 */
export function NewClosingDialog({
  open,
  step,
  year,
  month,
  yearOptions,
  monthOptions,
  isLoadingMonths,
  notes,
  preview,
  isCalculating,
  isSaving,
  onClose,
  onYearChange,
  onMonthChange,
  onApplyLastMonth,
  onCalculatePreview,
  onAddVariableCost,
  onRemoveVariableCost,
  onBackToCompetence,
  onNotesChange,
  onConfirm,
}: NewClosingDialogProps) {
  const selected = monthOptions.find((option) => option.month === month) ?? null;
  // Mês fechado só chega aqui pelo atalho "Último mês" (o select o trava): a
  // prévia fica bloqueada porque a confirmação seria recusada por sobreposição.
  const canCalculate = selected != null && selected.availability !== "fechado";

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Novo Fechamento Financeiro
          </DialogTitle>
          <DialogDescription>
            {step === "competencia"
              ? "Escolha o mês e o ano a fechar e calcule a prévia — nada é gravado nesse passo."
              : "Confira os números calculados no servidor. Ao confirmar, valores e rateio são congelados."}
          </DialogDescription>
        </DialogHeader>

        {step === "competencia" ? (
          <>
            <CompetencePicker
              year={year}
              month={month}
              yearOptions={yearOptions}
              monthOptions={monthOptions}
              isLoadingMonths={isLoadingMonths}
              disabled={isCalculating}
              onYearChange={onYearChange}
              onMonthChange={onMonthChange}
              onApplyLastMonth={onApplyLastMonth}
            />

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isCalculating}>
                Cancelar
              </Button>
              <Button
                onClick={onCalculatePreview}
                disabled={isCalculating || !canCalculate}
                className="gap-2"
              >
                {isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
                Calcular prévia
              </Button>
            </DialogFooter>
          </>
        ) : (
          preview && (
            <>
              <div className="space-y-4 pt-2">
                <ClosingSummary
                  closing={preview}
                  fixedCostItems={preview.fixedCosts.items}
                  warnings={preview.warnings}
                  onAddVariableCost={onAddVariableCost}
                  onRemoveVariableCost={onRemoveVariableCost}
                  isRecalculating={isCalculating}
                />

                <div className="space-y-2">
                  <Label htmlFor="closing-notes">Observações</Label>
                  <Textarea
                    id="closing-notes"
                    value={notes}
                    onChange={(e) => onNotesChange(e.target.value)}
                    placeholder="Opcional — contexto do fechamento, ajustes combinados etc."
                    maxLength={500}
                    rows={3}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={onBackToCompetence}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                {/*
                  Travado durante o recálculo: confirmar com um lançamento em voo
                  gravaria a lista antiga enquanto a tela já mostra a nova.
                */}
                <Button onClick={onConfirm} disabled={isSaving || isCalculating} className="gap-2">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                  Confirmar fechamento
                </Button>
              </DialogFooter>
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}

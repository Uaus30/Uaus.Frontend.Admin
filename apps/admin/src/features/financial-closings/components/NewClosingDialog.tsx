import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import {
  formatDateInput,
  guardCalendarDismiss,
  parseDateInput,
} from "@/components/ui/date-field";
import { ArrowLeft, CalendarRange, Loader2, Lock } from "lucide-react";
import { ClosingSummary } from "./ClosingSummary";
import type { FinancialClosingPreviewDto, NewClosingStep } from "../types";

interface NewClosingDialogProps {
  open: boolean;
  step: NewClosingStep;
  /** Início do período (`yyyy-MM-dd`). */
  periodStart: string;
  /** Fim do período, inclusivo (`yyyy-MM-dd`). */
  periodEnd: string;
  notes: string;
  preview: FinancialClosingPreviewDto | null;
  isCalculating: boolean;
  isSaving: boolean;
  onClose: () => void;
  onPeriodChange: (periodStart: string, periodEnd: string) => void;
  onApplyPreviousMonth: () => void;
  onCalculatePreview: () => void;
  onBackToPeriod: () => void;
  onNotesChange: (notes: string) => void;
  onConfirm: () => void;
}

/**
 * NewClosingDialog
 *
 * Diálogo de novo fechamento em dois passos: escolha do período (com atalho
 * "Mês anterior") → prévia calculada no servidor + observações + confirmação.
 * A prévia não persiste nada; ao confirmar, o servidor recalcula e congela.
 */
export function NewClosingDialog({
  open,
  step,
  periodStart,
  periodEnd,
  notes,
  preview,
  isCalculating,
  isSaving,
  onClose,
  onPeriodChange,
  onApplyPreviousMonth,
  onCalculatePreview,
  onBackToPeriod,
  onNotesChange,
  onConfirm,
}: NewClosingDialogProps) {
  // O hook trafega as datas como string (yyyy-MM-dd); o calendário trabalha
  // com Date. A conversão fica na borda, sem mexer no hook.
  const range: DateRange = {
    from: parseDateInput(periodStart),
    to: parseDateInput(periodEnd),
  };

  /** Aplica o período escolhido no calendário. */
  function handleRangeChange(newRange: DateRange) {
    onPeriodChange(formatDateInput(newRange.from), formatDateInput(newRange.to));
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      {/*
        O calendário abre num portal fora do modal; sem as guardas abaixo, o
        Radix trataria o clique num dia como interação externa e fecharia o
        diálogo inteiro.
      */}
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={guardCalendarDismiss}
        onFocusOutside={guardCalendarDismiss}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Novo Fechamento Financeiro
          </DialogTitle>
          <DialogDescription>
            {step === "periodo"
              ? "Escolha o período a fechar e calcule a prévia — nada é gravado nesse passo."
              : "Confira os números calculados no servidor. Ao confirmar, valores e rateio são congelados."}
          </DialogDescription>
        </DialogHeader>

        {step === "periodo" ? (
          <>
            <div className="space-y-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="closing-period">Período do fechamento</Label>
                {/*
                  Período travado durante o cálculo: mudar as datas com a
                  prévia em voo confirmaria um período diferente do exibido.
                */}
                <div className="flex flex-wrap items-center gap-2">
                  <DateRangePicker
                    id="closing-period"
                    className="w-64"
                    value={range}
                    onChange={handleRangeChange}
                    disabled={isCalculating}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onApplyPreviousMonth}
                    disabled={isCalculating}
                    className="gap-1.5"
                  >
                    <CalendarRange className="h-4 w-4" />
                    Mês anterior
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Recomendado fechar o mês-calendário cheio: os custos fixos entram por
                  competência mensal, sem pró-rata.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isCalculating}>
                Cancelar
              </Button>
              <Button
                onClick={onCalculatePreview}
                disabled={isCalculating || !periodStart || !periodEnd}
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
                  onClick={onBackToPeriod}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                <Button onClick={onConfirm} disabled={isSaving} className="gap-2">
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
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

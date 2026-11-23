import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from "@workspace/ui";
import { ArrowLeft, ArrowRight, Loader2, Lock } from "lucide-react";
import { CompetencePicker } from "./CompetencePicker";
import { ResultAndCashStep } from "./ResultAndCashStep";
import { BalanceStep } from "./BalanceStep";
import type { useNewClosing } from "../hooks/useNewClosing";
import type { NewClosingStep } from "../types";

interface NewClosingDialogProps {
  closing: ReturnType<typeof useNewClosing>;
}

const STEPS: { key: NewClosingStep; label: string }[] = [
  { key: "competencia", label: "Competência" },
  { key: "resultado", label: "Resultado e caixa" },
  { key: "saldo", label: "Retiradas e saldo" },
];

const DESCRIPTIONS: Record<NewClosingStep, string> = {
  competencia: "Escolha o mês a fechar e calcule a prévia — nada é gravado nesse passo.",
  resultado: "Confira o resultado e o caixa calculados no servidor. Os custos variáveis entram aqui.",
  saldo: "Digite as retiradas e confirme o saldo que fica para a loja. Ao confirmar, tudo é congelado.",
};

/** Os três passos, com o atual em destaque — no celular, só os números. */
function StepIndicator({ step }: { step: NewClosingStep }) {
  const current = STEPS.findIndex((item) => item.key === step);
  return (
    <ol className="flex items-center gap-2 text-xs" aria-label="Passos do fechamento">
      {STEPS.map((item, index) => (
        <li
          key={item.key}
          aria-current={index === current ? "step" : undefined}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
            index === current
              ? "border-primary bg-primary/10 font-semibold text-foreground"
              : "text-muted-foreground",
          )}
        >
          <span>{index + 1}</span>
          <span className={cn(index !== current && "hidden sm:inline")}>{item.label}</span>
        </li>
      ))}
    </ol>
  );
}

/**
 * NewClosingDialog
 *
 * O novo fechamento em três passos (23/11/2026): competência → resultado e
 * caixa → retiradas e saldo. A prévia não persiste nada; ao confirmar, o
 * servidor recalcula e congela tudo — números, rateio, retiradas e o saldo que
 * abre o mês seguinte. Renderiza o que `useNewClosing` devolve.
 */
export function NewClosingDialog({ closing }: NewClosingDialogProps) {
  const { step, preview, competence } = closing;
  const busy = closing.isCalculating || closing.isSaving;

  return (
    <Dialog open={closing.open} onOpenChange={(value) => !value && closing.closeNewClosing()}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Novo Fechamento Financeiro
          </DialogTitle>
          <DialogDescription>{DESCRIPTIONS[step]}</DialogDescription>
          <StepIndicator step={step} />
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1 pt-2">
          {step === "competencia" && (
            <CompetencePicker
              year={competence.year}
              month={competence.month}
              yearOptions={competence.yearOptions}
              monthOptions={competence.monthOptions}
              isLoadingMonths={competence.isLoadingMonths}
              next={competence.next}
              disabled={closing.isCalculating}
              onYearChange={competence.handleYearChange}
              onMonthChange={competence.handleMonthChange}
              onApplySuggested={competence.applySuggested}
            />
          )}
          {step === "resultado" && preview && (
            <ResultAndCashStep
              preview={preview}
              isImplantation={closing.isImplantation}
              isRecalculating={closing.isCalculating}
              onAddVariableCost={closing.handleAddVariableCost}
              onRemoveVariableCost={closing.handleRemoveVariableCost}
            />
          )}
          {step === "saldo" && preview && (
            <BalanceStep
              preview={preview}
              isImplantation={closing.isImplantation}
              withdrawalDrafts={closing.withdrawalDrafts}
              onWithdrawalChange={closing.setWithdrawal}
              openingBalanceText={closing.openingBalanceText}
              onOpeningBalanceChange={closing.setOpeningBalanceText}
              onCommit={closing.commitBalanceInputs}
              closingBalanceText={closing.closingBalanceText}
              onClosingBalanceChange={closing.setClosingBalance}
              balanceNotes={closing.balanceNotes}
              onBalanceNotesChange={closing.setBalanceNotes}
              notes={closing.notes}
              onNotesChange={closing.setNotes}
              balance={closing.balance}
              inputsDirty={closing.inputsDirty}
              isRecalculating={closing.isCalculating}
            />
          )}
        </div>

        <DialogFooter className="gap-2">
          {step === "competencia" ? (
            <>
              <Button variant="outline" onClick={closing.closeNewClosing} disabled={closing.isCalculating}>
                Cancelar
              </Button>
              <Button
                onClick={closing.handleCalculatePreview}
                disabled={closing.isCalculating || !competence.selected || competence.selected.disabled}
                className="gap-2"
              >
                {closing.isCalculating && <Loader2 className="h-4 w-4 animate-spin" />}
                Calcular prévia
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={step === "saldo" ? closing.backToResult : closing.backToCompetence}
                disabled={busy}
                className="gap-1.5"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              {step === "resultado" ? (
                <Button onClick={closing.goToBalance} disabled={busy} className="gap-1.5">
                  Avançar
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                // Travado durante o recálculo e com retirada fora da conta:
                // confirmar ali gravaria um saldo que a tela não mostrou.
                <Button
                  onClick={closing.handleConfirmClosing}
                  disabled={!closing.canConfirm}
                  className="gap-2"
                >
                  {closing.isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Lock className="h-4 w-4" />
                  )}
                  Confirmar fechamento
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

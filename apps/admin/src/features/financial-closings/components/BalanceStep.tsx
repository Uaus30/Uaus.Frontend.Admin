import type { ReactNode } from "react";
import { AlertTriangle, Info, Loader2 } from "lucide-react";
import { Input, Label, Textarea, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import {
  BALANCE_NOTES_MAX_LENGTH,
  parseAmountField,
  type BalanceCheck,
  type WithdrawalDrafts,
} from "../closing-balance";
import type { FinancialClosingPreviewDto } from "../types";

interface BalanceStepProps {
  preview: FinancialClosingPreviewDto;
  isImplantation: boolean;
  withdrawalDrafts: WithdrawalDrafts;
  onWithdrawalChange: (partnerId: number, text: string) => void;
  openingBalanceText: string;
  onOpeningBalanceChange: (text: string) => void;
  /** Leva as retiradas e o saldo inicial digitados à conta — ao sair do campo. */
  onCommit: () => void;
  closingBalanceText: string;
  onClosingBalanceChange: (text: string) => void;
  balanceNotes: string;
  onBalanceNotesChange: (text: string) => void;
  notes: string;
  onNotesChange: (text: string) => void;
  balance: BalanceCheck;
  /** Há retirada ou saldo inicial digitados e ainda fora da conta. */
  inputsDirty: boolean;
  isRecalculating: boolean;
}

/** Campo de valor com o que digitou de errado: ilegível ou negativo. */
function invalidWithdrawal(text: string): boolean {
  const field = parseAmountField(text);
  return field.kind === "invalid" || (field.kind === "value" && field.value < 0);
}

/** Aviso âmbar: aceito, mas olhe. Nunca bloqueia (decisão F). */
function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Passo 3 do novo fechamento: retiradas e saldo (seção 3.2 do plano).
 *
 * - A retirada de cada sócio, ao lado do que o rateio dá a ele ("a distribuir
 *   R$ X"). Retirar menos deixa o dinheiro na loja; mais que o lucro é aceito,
 *   com aviso — e também quando as retiradas passam do caixa do mês.
 * - O saldo confirmado nasce com o calculado e o acompanha até alguém mexer.
 *   Diferença acima de R$ 1,00 exige a observação.
 * - Na implantação, o saldo no início do mês é opcional: sem ele, o fechamento
 *   registra só o confirmado, sem a conferência.
 *
 * Os números da conta vêm da prévia; a retirada digitada vai ao servidor ao
 * sair do campo, e a tela espera a resposta para liberar a confirmação.
 */
export function BalanceStep(props: BalanceStepProps) {
  const { preview, balance } = props;
  const cashExceeded = preview.withdrawalsTotal > 0 && preview.withdrawalsTotal > preview.monthCash;

  return (
    <div className="space-y-5">
      {props.isImplantation && (
        <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            Implantação: é o primeiro fechamento com saldo. O saldo no início do mês é opcional — sem ele,
            fica registrado só o saldo confirmado, sem a conferência do calculado.
          </p>
          <Label htmlFor="closing-opening-balance">Saldo no início do mês (opcional)</Label>
          <Input
            id="closing-opening-balance"
            type="number"
            step="0.01"
            placeholder="Em branco: sem conferência"
            value={props.openingBalanceText}
            onChange={(event) => props.onOpeningBalanceChange(event.target.value)}
            onBlur={props.onCommit}
            className="sm:w-56"
          />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-foreground">Retiradas dos sócios</p>
        <ul className="space-y-3">
          {preview.shares.map((share) => {
            const text = props.withdrawalDrafts[share.partnerId] ?? "";
            const invalid = invalidWithdrawal(text);
            const aboveShare = share.withdrawnAmount > 0 && share.withdrawnAmount > share.amount;
            return (
              <li key={share.partnerId} className="space-y-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Label htmlFor={`withdrawal-${share.partnerId}`} className="min-w-0">
                    <span className="block font-medium text-foreground">{share.partnerName}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      a distribuir {formatCurrency(share.amount)} · retirado{" "}
                      {formatCurrency(share.withdrawnAmount)}
                    </span>
                  </Label>
                  <Input
                    id={`withdrawal-${share.partnerId}`}
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0,00"
                    value={text}
                    onChange={(event) => props.onWithdrawalChange(share.partnerId, event.target.value)}
                    onBlur={props.onCommit}
                    aria-invalid={invalid}
                    className={cn("sm:w-44", invalid && "border-destructive")}
                  />
                </div>
                {invalid && <p className="text-xs text-destructive">Informe um valor de zero para cima.</p>}
                {aboveShare && <Warning>Retirada acima do que o rateio dá a {share.partnerName}.</Warning>}
              </li>
            );
          })}
        </ul>
        {cashExceeded && (
          <Warning>
            As retiradas ({formatCurrency(preview.withdrawalsTotal)}) passam do caixa do mês (
            {formatCurrency(preview.monthCash)}): o saldo da loja diminui.
          </Warning>
        )}
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-3 shadow-sm">
        <p className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">Saldo calculado</span>
          <span className="flex items-center gap-2 font-semibold tabular-nums">
            {props.isRecalculating && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            {preview.calculatedBalance == null
              ? "— (sem saldo inicial)"
              : formatCurrency(preview.calculatedBalance)}
          </span>
        </p>
        {props.inputsDirty && !props.isRecalculating && (
          <p className="text-xs text-muted-foreground">
            Saia do campo para a conta incluir o que foi digitado.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="closing-confirmed-balance">Saldo confirmado *</Label>
          <Input
            id="closing-confirmed-balance"
            type="number"
            step="0.01"
            value={props.closingBalanceText}
            onChange={(event) => props.onClosingBalanceChange(event.target.value)}
            className="sm:w-56"
          />
          <p className="text-xs text-muted-foreground">
            Dinheiro + conta + Pix no fim do mês (e o cartão a receber, se quiser). Abre o mês seguinte.
          </p>
        </div>

        {balance.difference !== null && (
          <p
            data-testid="balance-difference"
            className={cn(
              "flex justify-between gap-3 text-sm",
              balance.difference !== 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            <span>Diferença (confirmado − calculado)</span>
            <span className="font-semibold tabular-nums">{formatCurrency(balance.difference)}</span>
          </p>
        )}
        {balance.negative && (
          <Warning>Saldo confirmado negativo: aceito, e o mês seguinte começa devendo.</Warning>
        )}

        {balance.notesRequired && (
          <div className="space-y-1.5">
            <Label htmlFor="closing-balance-notes">Explique a diferença *</Label>
            <Textarea
              id="closing-balance-notes"
              value={props.balanceNotes}
              onChange={(event) => props.onBalanceNotesChange(event.target.value)}
              placeholder="Taxa de cartão, venda no cartão que ainda não caiu, despesa fora do sistema..."
              maxLength={BALANCE_NOTES_MAX_LENGTH}
              rows={2}
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="closing-notes">Observações do fechamento</Label>
        <Textarea
          id="closing-notes"
          value={props.notes}
          onChange={(event) => props.onNotesChange(event.target.value)}
          placeholder="Opcional — contexto do fechamento, ajustes combinados etc."
          maxLength={500}
          rows={2}
        />
      </div>
    </div>
  );
}

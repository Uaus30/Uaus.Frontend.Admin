import { Wallet } from "lucide-react";
import { formatCurrency } from "@workspace/core";
import { PurchaseBandBadge } from "@/components/purchase-band-badge";
import { purchaseBandOf } from "@/lib/purchase-band";
import { LEGACY_CLOSING_NOTE, isLegacyClosing, newFieldText } from "../closing-statement";
import { StatementRow, StatementSection } from "./StatementRow";
import type { ClosingNumbers } from "../types";

interface ClosingCashBlockProps {
  closing: ClosingNumbers;
  /** Implantação: o saldo inicial é opcional, e a falta dele não é erro. */
  isImplantation?: boolean;
  /**
   * Mostra o saldo confirmado, a diferença e a observação — o documento
   * congelado. Na prévia esse trecho é o passo 3, editável.
   */
  showConfirmation?: boolean;
}

/** Diferença zero é neutra; qualquer outra pede atenção (âmbar), nunca vermelho. */
function differenceTone(value: number | null | undefined) {
  return value != null && value !== 0 ? ("warning" as const) : undefined;
}

/**
 * ClosingCashBlock
 *
 * O caixa do mês — o saldo, que abre o mês seguinte (seção 3.2 do plano):
 *
 * ```
 *   Saldo inicial + vendas + aportes − compras pagas − fixos − variáveis
 * − retiradas = saldo calculado
 * ```
 *
 * O saldo confirmado (dinheiro + conta + Pix) é digitado no fechamento e vira o
 * saldo inicial do mês seguinte; a diferença para o calculado fica registrada
 * com a explicação. O "caixa do mês" é a mesma conta sem o saldo inicial e sem
 * as retiradas: é com ele que as retiradas se comparam.
 */
export function ClosingCashBlock({ closing, isImplantation, showConfirmation }: ClosingCashBlockProps) {
  const legacy = isLegacyClosing(closing);
  const band = legacy ? null : purchaseBandOf(closing.purchaseBand);
  const opening =
    !legacy && closing.openingBalance == null && isImplantation
      ? "não informado"
      : newFieldText(legacy, closing.openingBalance);

  return (
    <StatementSection icon={Wallet} title="Caixa do mês" note={legacy ? LEGACY_CLOSING_NOTE : undefined}>
      <StatementRow
        label="Saldo inicial"
        value={opening}
        hint={isImplantation ? "Implantação: opcional" : undefined}
      />
      <StatementRow sign="+" label="Vendas líquidas" value={formatCurrency(closing.revenue)} />
      <StatementRow sign="+" label="Aportes" value={newFieldText(legacy, closing.contributionsTotal)} />
      <StatementRow
        sign="−"
        label="Compras pagas"
        value={newFieldText(legacy, closing.purchasesPaidTotal)}
        hint="Pela data da compra (A caminho e Lançado)"
      />
      <StatementRow sign="−" label="Custos fixos" value={formatCurrency(closing.fixedCostsTotal)} />
      <StatementRow sign="−" label="Custos variáveis" value={formatCurrency(closing.variableCostsTotal)} />
      <StatementRow
        sign="−"
        label="Retiradas dos sócios"
        value={newFieldText(legacy, closing.withdrawalsTotal)}
      />
      <StatementRow
        sign="="
        emphasis
        label="Saldo calculado"
        value={newFieldText(legacy, closing.calculatedBalance)}
        hint={
          !legacy && closing.calculatedBalance == null
            ? "Sem saldo inicial, não há o que conferir"
            : undefined
        }
      />

      {showConfirmation && (
        <>
          <StatementRow
            label="Saldo confirmado"
            value={newFieldText(legacy, closing.closingBalance)}
            tone={closing.closingBalance != null && closing.closingBalance < 0 ? "negative" : undefined}
            hint="Abre o mês seguinte"
          />
          <StatementRow
            label="Diferença"
            value={newFieldText(legacy, closing.balanceDifference)}
            tone={differenceTone(closing.balanceDifference)}
            hint={closing.balanceNotes ?? undefined}
          />
        </>
      )}

      <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
        <p className="flex justify-between gap-3">
          <span>Caixa do mês (vendas + aportes − compras pagas − fixos − variáveis)</span>
          <span className="shrink-0 tabular-nums">{newFieldText(legacy, closing.monthCash)}</span>
        </p>
        <p className="flex justify-between gap-3">
          <span>Entradas de estoque (informativo)</span>
          <span className="shrink-0 tabular-nums">{formatCurrency(closing.purchasesTotal)}</span>
        </p>
        {band && (
          <p className="flex items-center justify-between gap-3">
            <span>Faixa de compras no fim do mês</span>
            <PurchaseBandBadge band={band} className="text-xs" />
          </p>
        )}
      </div>
    </StatementSection>
  );
}

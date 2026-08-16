import { Banknote, CreditCard, Split, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@workspace/ui";
import { Button, Input, Label } from "@workspace/ui";
import { ConsumerPicker } from "@/components/consumer-picker";
import { formatCurrency } from "@workspace/core";
import { type CheckoutState } from "@/hooks/use-checkout";
import { type PdvConsumer } from "@/stores/use-pdv-store";

export interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consumer: PdvConsumer;
  setConsumer: (c: PdvConsumer) => void;
  total: number;
  checkout: CheckoutState;
  savingSale: boolean;
  onConfirmPayment: () => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  consumer,
  setConsumer,
  total,
  checkout,
  savingSale,
  onConfirmPayment,
}: CheckoutDialogProps) {
  const {
    paymentMethods,
    payments,
    splitPayment,
    amountReceived,
    setAmountReceived,
    paidAmount,
    remainingAmount,
    feeAmount,
    cashPayment,
    change,
    cashShortfall,
    togglePaymentMethod,
    updatePaymentAmount,
    updatePaymentInstallment,
    toggleSplitPayment,
  } = checkout;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px] max-h-[92vh] p-0 overflow-y-auto bg-card border-border shadow-2xl">
        <div className="bg-primary/10 p-6 border-b border-border/50">
          <DialogTitle className="text-2xl font-display font-bold flex items-center gap-2">
            <Banknote className="w-6 h-6 text-primary" /> Pagamento
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Selecione a forma de pagamento para finalizar a venda.
          </DialogDescription>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <ConsumerPicker consumer={consumer} onChange={setConsumer} />

            <div className="h-px bg-border/60" />

            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Forma de Pagamento
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] gap-1.5 cursor-pointer"
                onClick={toggleSplitPayment}
              >
                <Split className="w-3.5 h-3.5" />
                {splitPayment ? "Pagamento único" : "Dividir"}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2.5 max-h-[240px] overflow-y-auto pr-1">
              {paymentMethods.map((pm) => {
                const selected = payments.find((p) => p.paymentMethodId === pm.id);
                const activeInstallments = pm.installments.filter((i) => i.isActive);

                return (
                  <div
                    key={pm.id}
                    className={`rounded-xl border transition-all ${
                      selected ? "border-primary bg-primary/10 ring-1 ring-primary" : "border-border"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => togglePaymentMethod(pm.id)}
                      className="w-full text-left p-3.5 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard
                          className={`w-5 h-5 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <div>
                          <p
                            className={`font-medium text-sm leading-none ${selected ? "text-primary" : "text-foreground"}`}
                          >
                            {pm.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            {activeInstallments.length > 1
                              ? `${activeInstallments.length} opções de parcela`
                              : "À vista (1x)"}
                          </p>
                        </div>
                      </div>
                      {selected && splitPayment && (
                        <span className="font-mono text-xs font-bold text-primary">
                          {formatCurrency(selected.amount)}
                        </span>
                      )}
                    </button>

                    {selected && splitPayment && (
                      <div className="px-3.5 pb-3 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-semibold">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="h-8 text-xs font-mono"
                          value={selected.amount}
                          onChange={(e) => updatePaymentAmount(pm.id, Number(e.target.value))}
                        />
                      </div>
                    )}

                    {selected && activeInstallments.length > 1 && (
                      <div className="px-3.5 pb-3 grid grid-cols-3 gap-1.5">
                        {activeInstallments.map((inst) => (
                          <button
                            key={inst.id}
                            type="button"
                            onClick={() => updatePaymentInstallment(pm.id, inst.installmentNumber)}
                            className={`p-1.5 text-[11px] rounded-md border text-left transition-all cursor-pointer ${
                              selected.installmentNumber === inst.installmentNumber
                                ? "border-primary bg-primary/15 text-primary font-bold"
                                : "border-border hover:bg-muted/40 text-foreground"
                            }`}
                          >
                            <span className="block">{inst.installmentNumber}x</span>
                            <span className="block text-[9px] text-muted-foreground font-mono">
                              {inst.feePercentage.toFixed(2)}%
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {splitPayment && (
              <p
                className={`text-xs ${Math.abs(remainingAmount) > 0.01 ? "text-destructive" : "text-muted-foreground"}`}
              >
                Distribuído: {formatCurrency(paidAmount)} de {formatCurrency(total)}
                {Math.abs(remainingAmount) > 0.01 &&
                  (remainingAmount > 0
                    ? ` — faltam ${formatCurrency(remainingAmount)}`
                    : ` — ${formatCurrency(Math.abs(remainingAmount))} a mais`)}
              </p>
            )}
          </div>

          <div className="bg-background rounded-2xl p-6 border border-border/50 flex flex-col justify-between">
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total da Venda</p>
                <p className="text-4xl font-mono font-bold text-primary">{formatCurrency(total)}</p>
                {feeAmount > 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-2">
                    Taxa de cartão da loja: {formatCurrency(feeAmount)}
                  </p>
                )}
                {payments.some((p) => p.installmentNumber > 1) && (
                  <p className="text-xs text-muted-foreground mt-1 font-mono font-semibold">
                    {payments
                      .filter((p) => p.installmentNumber > 1)
                      .map(
                        (p) => `${p.installmentNumber}x de ${formatCurrency(p.amount / p.installmentNumber)}`,
                      )
                      .join(" + ")}
                  </p>
                )}
              </div>

              {cashPayment && (
                <div className="mt-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label>Valor Recebido em Dinheiro</Label>
                    <Input
                      type="text"
                      placeholder="R$ 0,00"
                      className="h-12 text-lg font-mono"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {cashShortfall > 0 ? (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                      <p className="text-xs font-semibold uppercase text-destructive">Falta receber</p>
                      <p className="font-mono text-2xl font-bold text-destructive">
                        {formatCurrency(cashShortfall)}
                      </p>
                    </div>
                  ) : (
                    change > 0 && (
                      <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase">
                          Troco
                        </p>
                        <p className="text-2xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(change)}
                        </p>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            <Button
              size="lg"
              className="w-full h-14 mt-6 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => onConfirmPayment()}
              disabled={
                savingSale ||
                payments.length === 0 ||
                Math.abs(remainingAmount) > 0.01 ||
                cashShortfall > 0.01
              }
            >
              {savingSale ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Confirmar Pagamento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

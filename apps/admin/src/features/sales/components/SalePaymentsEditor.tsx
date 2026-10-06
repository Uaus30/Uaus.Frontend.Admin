import React from "react";
import { Plus, X } from "lucide-react";
import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@workspace/ui";
import { formatCurrency } from "@workspace/core";
import { CurrencyInput } from "@/features/products/components/CurrencyInput";
import type { PaymentSplit } from "../hooks/usePaymentSplits";
import {
  isSelectableMethod,
  paymentMethodChoices,
  type PaymentMethodOption,
} from "../lib/payment-method-options";

type SalePaymentsEditorProps = {
  payments: PaymentSplit[];
  methods: PaymentMethodOption[];
  remainingAmount: number;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, patch: Partial<PaymentSplit>) => void;
};

/**
 * As formas de pagamento da venda — a nova e a correção. Uma linha por forma:
 * a forma ocupa a largura que sobra e o valor tem largura fixa, para caber em
 * 375px; o X de remover tem 40px (era um ícone de 16px sem área de toque).
 */
export function SalePaymentsEditor({
  payments,
  methods,
  remainingAmount,
  onAdd,
  onRemove,
  onUpdate,
}: SalePaymentsEditorProps) {
  const usedIds = payments.map((payment) => payment.paymentMethodId);
  const choices = paymentMethodChoices(methods, usedIds);
  const canAdd = methods.some((method) => isSelectableMethod(method) && !usedIds.includes(method.id));

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">Formas de pagamento</span>
      {payments.map((payment, index) => (
        <div key={index} className="flex items-center gap-2">
          <Select
            value={String(payment.paymentMethodId)}
            onValueChange={(value) => onUpdate(index, { paymentMethodId: Number(value) })}
          >
            <SelectTrigger
              className="h-10 min-w-0 flex-1 bg-background"
              aria-label={`Forma de pagamento ${index + 1}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {choices.map((method) => (
                <SelectItem
                  key={method.id}
                  value={String(method.id)}
                  disabled={method.id !== payment.paymentMethodId && usedIds.includes(method.id)}
                >
                  {method.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <CurrencyInput
            value={payment.amount}
            onChange={(amount) => onUpdate(index, { amount })}
            // Com uma forma só o valor acompanha o total sozinho.
            readOnly={payments.length === 1}
            className="h-10 w-28 shrink-0 bg-background text-right"
          />
          {payments.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remover a forma de pagamento ${index + 1}`}
              className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={onAdd}
          disabled={!canAdd}
        >
          <Plus className="h-3.5 w-3.5" /> Dividir em outra forma
        </Button>
        {payments.length > 1 && Math.abs(remainingAmount) > 0.01 && (
          <span
            className={cn("text-xs font-medium", remainingAmount > 0 ? "text-amber-600" : "text-destructive")}
          >
            {remainingAmount > 0
              ? `Faltam ${formatCurrency(remainingAmount)}`
              : `${formatCurrency(Math.abs(remainingAmount))} a mais`}
          </span>
        )}
      </div>
    </div>
  );
}
